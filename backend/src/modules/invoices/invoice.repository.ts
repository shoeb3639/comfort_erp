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

export function findCustomer(tenantId: string, customerId: string) {
  return prisma.customer.findFirst({
    where: { tenantId, id: customerId, deletedAt: null },
  })
}

export function findBooking(tenantId: string, bookingId: string) {
  return prisma.booking.findFirst({
    where: { tenantId, id: bookingId, deletedAt: null },
    include: { customer: true },
  })
}

export function options(tenantId: string) {
  return Promise.all([
    prisma.customer.findMany({
      where: { tenantId, deletedAt: null, status: 'ACTIVE' },
      include: {
        travellers: { where: { status: 'ACTIVE' }, orderBy: { name: 'asc' } },
      },
      orderBy: { billingName: 'asc' },
    }),
    prisma.booking.findMany({
      where: { tenantId, deletedAt: null, status: { not: 'CANCELLED' } },
      include: { customer: true, traveller: true },
      orderBy: { createdAt: 'desc' },
      take: 500,
    }),
    prisma.vehicle.findMany({
      where: { tenantId, deletedAt: null, status: 'ACTIVE' },
      include: { vehicleType: true },
      orderBy: { registrationNumber: 'asc' },
    }),
    prisma.driver.findMany({
      where: { tenantId, deletedAt: null, status: 'ACTIVE' },
      orderBy: { name: 'asc' },
    }),
    prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        bankAccounts: {
          where: { status: 'ACTIVE' },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
          take: 1,
        },
        gstRegistrations: {
          where: { status: 'ACTIVE' },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
          take: 1,
        },
      },
    }),
  ])
}

export function save(
  tenantId: string,
  userId: string,
  invoiceId: string | null,
  data: Prisma.InvoiceUncheckedCreateInput,
  items: Prisma.InvoiceItemUncheckedCreateWithoutInvoiceInput[],
) {
  return prisma.$transaction(async (transaction) => {
    const current = invoiceId
      ? await transaction.invoice.findFirst({
          where: { tenantId, id: invoiceId, status: { not: 'CANCELLED' } },
        })
      : null
    if (invoiceId && !current) return null
    const invoice = current
      ? await transaction.invoice.update({
          where: { tenantId_id: { tenantId, id: current.id } },
          data: {
            ...data,
            createdById: current.createdById,
            status: current.status,
            updatedById: userId,
          },
        })
      : await transaction.invoice.create({ data })
    if (current) {
      await transaction.invoiceItem.deleteMany({
        where: { tenantId, invoiceId: invoice.id },
      })
    }
    await transaction.invoiceItem.createMany({
      data: items.map((item) => ({
        ...item,
        tenantId,
        invoiceId: invoice.id,
      })),
    })
    await transaction.tenantAuditLog.create({
      data: {
        tenantId,
        actorUserId: userId,
        module: 'INVOICE',
        action: current
          ? current.status === 'GENERATED'
            ? 'REVISE'
            : 'UPDATE_DRAFT'
          : 'CREATE_DRAFT',
        referenceId: invoice.id,
        ...(current
          ? {
              oldValues: {
                status: current.status,
                netPayable: Number(current.netPayable),
              },
            }
          : {}),
        newValues: {
          status: invoice.status,
          netPayable: Number(invoice.netPayable),
        },
      },
    })
    return transaction.invoice.findUnique({
      where: { tenantId_id: { tenantId, id: invoice.id } },
      include: invoiceInclude,
    })
  })
}

export function cancel(
  tenantId: string,
  invoiceId: string,
  userId: string,
  reason: string,
) {
  return prisma.$transaction(async (transaction) => {
    const current = await transaction.invoice.findFirst({
      where: { tenantId, id: invoiceId, status: 'GENERATED' },
    })
    if (!current) return null
    const invoice = await transaction.invoice.update({
      where: { tenantId_id: { tenantId, id: invoiceId } },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledById: userId,
        cancellationReason: reason,
        updatedById: userId,
      },
      include: invoiceInclude,
    })
    await transaction.tenantAuditLog.create({
      data: {
        tenantId,
        actorUserId: userId,
        module: 'INVOICE',
        action: 'CANCEL',
        referenceId: invoiceId,
        oldValues: { status: current.status },
        newValues: { status: 'CANCELLED' },
        remarks: reason,
      },
    })
    return invoice
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
          include: {
            bankAccounts: {
              where: { status: 'ACTIVE' },
              orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
              take: 1,
            },
            gstRegistrations: {
              where: { status: 'ACTIVE' },
              orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
              take: 1,
            },
          },
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
      const existingSnapshot =
        invoice.displaySnapshot &&
        typeof invoice.displaySnapshot === 'object' &&
        !Array.isArray(invoice.displaySnapshot)
          ? invoice.displaySnapshot
          : {}
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
          displaySnapshot: {
            ...existingSnapshot,
            companyDetails: tenant
              ? {
                  name: tenant.tradeName || tenant.legalName,
                  address: [
                    tenant.addressLine1,
                    tenant.addressLine2,
                    tenant.city,
                    tenant.state,
                    tenant.pinCode,
                  ]
                    .filter(Boolean)
                    .join(', '),
                  website: tenant.website,
                  mobile: tenant.mobile,
                  gstNumber:
                    tenant.gstRegistrations[0]?.gstin || tenant.gstin,
                  category: tenant.businessType,
                }
              : null,
            bankDetails: tenant?.bankAccounts[0]
              ? {
                  accountName: tenant.bankAccounts[0].accountName,
                  accountNumber: tenant.bankAccounts[0].accountNumber,
                  bankName: tenant.bankAccounts[0].bankName,
                  ifscCode: tenant.bankAccounts[0].ifscCode,
                  upiId: tenant.bankAccounts[0].upiId,
                }
              : null,
          },
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
