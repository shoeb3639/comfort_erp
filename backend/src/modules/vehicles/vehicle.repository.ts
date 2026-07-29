import type {
  Prisma,
  SetupRecordStatus,
  VehicleOwnershipType,
} from '../../generated/prisma/client'
import { prisma } from '../../config/prisma'

export interface VehicleFilters {
  search?: string
  ownershipType?: VehicleOwnershipType
  vendorId?: string
  vehicleTypeId?: string
  status?: SetupRecordStatus
}

const include = {
  vendor: { select: { id: true, name: true } },
  vehicleType: { select: { id: true, name: true } },
} satisfies Prisma.VehicleInclude

export function list(tenantId: string, filters: VehicleFilters) {
  return prisma.vehicle.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(filters.ownershipType
        ? { ownershipType: filters.ownershipType }
        : {}),
      ...(filters.vendorId ? { vendorId: filters.vendorId } : {}),
      ...(filters.vehicleTypeId
        ? { vehicleTypeId: filters.vehicleTypeId }
        : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.search
        ? {
            OR: [
              {
                registrationNumber: {
                  contains: filters.search,
                  mode: 'insensitive' as const,
                },
              },
              {
                make: {
                  contains: filters.search,
                  mode: 'insensitive' as const,
                },
              },
              {
                model: {
                  contains: filters.search,
                  mode: 'insensitive' as const,
                },
              },
            ],
          }
        : {}),
    },
    include,
    orderBy: { createdAt: 'desc' },
  })
}

export function find(tenantId: string, id: string) {
  return prisma.vehicle.findFirst({
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

export function listTypes(tenantId: string) {
  return prisma.vehicleType.findMany({
    where: { tenantId, status: 'ACTIVE' },
    orderBy: { name: 'asc' },
  })
}

export function findType(tenantId: string, id: string) {
  return prisma.vehicleType.findFirst({
    where: { tenantId, id, status: 'ACTIVE' },
  })
}

export function findTypeByName(tenantId: string, name: string) {
  return prisma.vehicleType.findFirst({
    where: { tenantId, name: { equals: name, mode: 'insensitive' } },
  })
}

export function createType(tenantId: string, name: string) {
  return prisma.vehicleType.create({ data: { tenantId, name } })
}

export function create(
  transaction: Prisma.TransactionClient,
  data: Prisma.VehicleUncheckedCreateInput,
) {
  return transaction.vehicle.create({ data, include })
}

export function update(
  transaction: Prisma.TransactionClient,
  id: string,
  data: Prisma.VehicleUncheckedUpdateInput,
) {
  return transaction.vehicle.update({ where: { id }, data, include })
}

export { include as vehicleInclude }
