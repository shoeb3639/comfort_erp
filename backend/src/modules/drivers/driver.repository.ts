import type {
  DriverEngagementType,
  Prisma,
  SetupRecordStatus,
} from '../../generated/prisma/client'
import { prisma } from '../../config/prisma'
import type { PageRequest } from '../../shared/pagination'
import { pageWindow } from '../../shared/pagination'

export interface DriverFilters extends PageRequest {
  search?: string
  engagementType?: DriverEngagementType
  vendorId?: string
  status?: SetupRecordStatus
}

const include = {
  vendor: { select: { id: true, name: true } },
} satisfies Prisma.DriverInclude

export function list(tenantId: string, filters: DriverFilters) {
  const where = {
    tenantId,
    deletedAt: null,
    ...(filters.engagementType
      ? { engagementType: filters.engagementType }
      : {}),
    ...(filters.vendorId ? { vendorId: filters.vendorId } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.search
      ? {
          OR: [
            { name: { contains: filters.search, mode: 'insensitive' } },
            { mobile: { contains: filters.search, mode: 'insensitive' } },
            {
              licenceNumber: {
                contains: filters.search,
                mode: 'insensitive',
              },
            },
          ],
        }
      : {}),
  } satisfies Prisma.DriverWhereInput
  return Promise.all([
    prisma.driver.findMany({
      where,
      include,
      orderBy: { createdAt: 'desc' },
      ...pageWindow(filters),
    }),
    prisma.driver.count({ where }),
  ])
}
export function find(tenantId: string, id: string) {
  return prisma.driver.findFirst({
    where: { tenantId, id, deletedAt: null },
    include,
  })
}
export function findVendor(tenantId: string, vendorId: string) {
  return prisma.vendor.findFirst({
    where: {
      tenantId,
      id: vendorId,
      deletedAt: null,
      status: 'ACTIVE',
      recordType: { not: 'own_company' },
    },
  })
}
export function create(
  transaction: Prisma.TransactionClient,
  data: Prisma.DriverUncheckedCreateInput,
) {
  return transaction.driver.create({ data, include })
}
export function update(
  transaction: Prisma.TransactionClient,
  id: string,
  data: Prisma.DriverUncheckedUpdateInput,
) {
  return transaction.driver.update({ where: { id }, data, include })
}
