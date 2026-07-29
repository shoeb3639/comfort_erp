import { Prisma } from '../../generated/prisma/client'
import { prisma } from '../../config/prisma'

export const invoiceInclude = {
  booking: true,
  customer: true,
  items: { orderBy: { sortOrder: 'asc' as const } },
  tenant: {
    include: {
      bankAccounts: {
        where: { status: 'ACTIVE' as const },
        orderBy: [
          { isDefault: 'desc' as const },
          { createdAt: 'asc' as const },
        ],
        take: 1,
      },
      gstRegistrations: {
        where: { status: 'ACTIVE' as const },
        orderBy: [
          { isDefault: 'desc' as const },
          { createdAt: 'asc' as const },
        ],
        take: 1,
      },
    },
  },
} satisfies Prisma.InvoiceInclude

export function list(
  tenantId: string,
  filters: { search?: string; status?: string },
) {
  return prisma.invoice.findMany({
    where: {
      tenantId,
      ...(filters.status ? { status: filters.status as never } : {}),
      ...(filters.search
        ? {
            OR: [
              {
                invoiceNumber: {
                  contains: filters.search,
                  mode: 'insensitive' as const,
                },
              },
              {
                billingName: {
                  contains: filters.search,
                  mode: 'insensitive' as const,
                },
              },
              {
                booking: {
                  bookingNumber: {
                    contains: filters.search,
                    mode: 'insensitive' as const,
                  },
                },
              },
            ],
          }
        : {}),
    },
    include: invoiceInclude,
    orderBy: [{ invoiceDate: 'desc' }, { createdAt: 'desc' }],
  })
}

export function find(tenantId: string, invoiceId: string) {
  return prisma.invoice.findFirst({
    where: { tenantId, id: invoiceId },
    include: invoiceInclude,
  })
}

export function generate(
  tenantId: string,
  invoiceId: string,
  userId: string,
  financialYear: string,
) {
  return prisma.$transaction(
    async (transaction) => {
      const [invoice, tenant, sequence] = await Promise.all([
        transaction.invoice.findFirst({
          where: { tenantId, id: invoiceId, status: 'DRAFT' },
        }),
        transaction.tenant.findUnique({
          where: { id: tenantId },
          select: { invoicePrefix: true, invoiceNumberLength: true },
        }),
        transaction.invoice.aggregate({
          where: { tenantId, invoiceSequence: { not: null } },
          _max: { invoiceSequence: true },
        }),
      ])
      if (!invoice) return null
      const nextSequence = (sequence._max.invoiceSequence ?? 0) + 1
      const prefix = tenant?.invoicePrefix || 'INV'
      const invoiceNumber = `${prefix}/${financialYear}/${String(nextSequence).padStart(tenant?.invoiceNumberLength ?? 6, '0')}`
      const updated = await transaction.invoice.update({
        where: { tenantId_id: { tenantId, id: invoiceId } },
        data: {
          invoicePrefix: prefix,
          invoiceSequence: nextSequence,
          invoiceNumber,
          financialYear,
          status: 'GENERATED',
          generatedAt: new Date(),
          generatedById: userId,
          updatedById: userId,
        },
        include: invoiceInclude,
      })
      await transaction.tenantAuditLog.create({
        data: {
          tenantId,
          actorUserId: userId,
          module: 'INVOICE',
          action: 'GENERATE',
          referenceId: invoiceId,
          newValues: { invoiceNumber },
        },
      })
      return updated
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  )
}
