import type { Prisma, SetupRecordStatus } from '../../generated/prisma/client'
import { prisma } from '../../config/prisma'
import type { PageRequest } from '../../shared/pagination'
import { pageWindow } from '../../shared/pagination'
import type { VendorContext } from './vendor.types'

export interface VendorFilters extends PageRequest {
  search?: string
  recordType?: string
  status?: SetupRecordStatus
}

const include = {
  vehicles: {
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' as const },
  },
  drivers: {
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' as const },
  },
} satisfies Prisma.VendorInclude

export function transaction<T>(
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
) {
  return prisma.$transaction(operation)
}

export function list(tenantId: string, filters: VendorFilters) {
  const where = {
    tenantId,
    deletedAt: null,
    ...(filters.recordType ? { recordType: filters.recordType } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.search
      ? {
          OR: [
            { name: { contains: filters.search, mode: 'insensitive' } },
            { category: { contains: filters.search, mode: 'insensitive' } },
            { city: { contains: filters.search, mode: 'insensitive' } },
            { phone: { contains: filters.search, mode: 'insensitive' } },
            {
              vehicles: {
                some: {
                  registrationNumber: {
                    contains: filters.search,
                    mode: 'insensitive',
                  },
                  deletedAt: null,
                },
              },
            },
            {
              drivers: {
                some: {
                  name: { contains: filters.search, mode: 'insensitive' },
                  deletedAt: null,
                },
              },
            },
          ],
        }
      : {}),
  } satisfies Prisma.VendorWhereInput

  return Promise.all([
    prisma.vendor.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include,
      ...pageWindow(filters),
    }),
    prisma.vendor.count({ where }),
  ])
}

export function find(tenantId: string, vendorId: string) {
  return prisma.vendor.findFirst({
    where: { tenantId, id: vendorId, deletedAt: null },
    include,
  })
}

export function create(
  transactionClient: Prisma.TransactionClient,
  data: Prisma.VendorUncheckedCreateInput,
) {
  return transactionClient.vendor.create({ data })
}

export function update(
  transactionClient: Prisma.TransactionClient,
  vendorId: string,
  data: Prisma.VendorUncheckedUpdateInput,
) {
  return transactionClient.vendor.update({
    where: { id: vendorId },
    data,
    include,
  })
}

export function countChildren(tenantId: string, vendorId: string) {
  return prisma.$transaction([
    prisma.vehicle.count({
      where: { tenantId, vendorId, deletedAt: null },
    }),
    prisma.driver.count({
      where: { tenantId, vendorId, deletedAt: null },
    }),
  ])
}

export function softDelete(
  transactionClient: Prisma.TransactionClient,
  vendorId: string,
  userId: string,
) {
  return transactionClient.vendor.update({
    where: { id: vendorId },
    data: {
      deletedAt: new Date(),
      deletedById: userId,
      status: 'INACTIVE',
    },
  })
}

export function audit(
  transactionClient: Prisma.TransactionClient,
  context: VendorContext,
  action: string,
  referenceId: string,
) {
  return transactionClient.tenantAuditLog.create({
    data: {
      tenantId: context.tenantId,
      actorUserId: context.userId,
      module: 'VENDOR',
      action,
      referenceId,
    },
  })
}
