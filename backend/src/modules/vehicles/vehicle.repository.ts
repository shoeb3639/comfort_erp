import type {
  Prisma,
  SetupRecordStatus,
  VehicleOwnershipType,
} from '../../generated/prisma/client'
import { prisma } from '../../config/prisma'
import type { PageRequest } from '../../shared/pagination'
import { pageWindow } from '../../shared/pagination'

export interface VehicleFilters extends PageRequest {
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
  const where = {
    tenantId,
    deletedAt: null,
    ...(filters.ownershipType ? { ownershipType: filters.ownershipType } : {}),
    ...(filters.vendorId ? { vendorId: filters.vendorId } : {}),
    ...(filters.vehicleTypeId ? { vehicleTypeId: filters.vehicleTypeId } : {}),
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
  } satisfies Prisma.VehicleWhereInput
  return Promise.all([
    prisma.vehicle.findMany({
      where,
      include,
      orderBy: { createdAt: 'desc' },
      ...pageWindow(filters),
    }),
    prisma.vehicle.count({ where }),
  ])
}

export function find(tenantId: string, id: string) {
  return prisma.vehicle.findFirst({
    where: { tenantId, id, deletedAt: null },
    include,
  })
}

function ledgerDateRange(dateFrom?: Date, dateTo?: Date) {
  return {
    ...(dateFrom ? { gte: dateFrom } : {}),
    ...(dateTo ? { lte: dateTo } : {}),
  }
}

export function ledgerBookings(
  tenantId: string,
  vehicleId: string,
  dateFrom?: Date,
  dateTo?: Date,
) {
  return prisma.booking.findMany({
    where: {
      tenantId,
      vehicleId,
      deletedAt: null,
      ...(dateFrom || dateTo
        ? { startDate: ledgerDateRange(dateFrom, dateTo) }
        : {}),
    },
    select: {
      id: true,
      bookingNumber: true,
      startDate: true,
      travellingFrom: true,
      travellingTo: true,
      serviceCity: true,
      status: true,
      openingOdometer: true,
      closingOdometer: true,
      customer: { select: { billingName: true } },
      driver: { select: { name: true } },
      closure: {
        select: {
          actualRunningKm: true,
          baseFare: true,
          tollTax: true,
          parking: true,
          driverAllowance: true,
          otherRecoverableCharges: true,
          totalBillAmount: true,
          dieselCost: true,
          directVehicleExpense: true,
          driverCost: true,
          allocatedOfficeExpense: true,
          vehicleRevenue: true,
          netVehicleProfit: true,
          finalVendorPayable: true,
          vendorBookingProfit: true,
          commissionProfit: true,
          profitDataStatus: true,
        },
      },
    },
    orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }],
  })
}

export function ledgerExpenses(
  tenantId: string,
  vehicleId: string,
  dateFrom?: Date,
  dateTo?: Date,
) {
  return prisma.accountTransaction.findMany({
    where: {
      tenantId,
      vehicleId,
      transactionType: 'EXPENSE',
      direction: 'DEBIT',
      ...(dateFrom || dateTo
        ? { transactionDate: ledgerDateRange(dateFrom, dateTo) }
        : {}),
    },
    select: {
      id: true,
      transactionDate: true,
      bookingId: true,
      category: true,
      amount: true,
      description: true,
      referenceNumber: true,
    },
    orderBy: [{ transactionDate: 'desc' }, { createdAt: 'desc' }],
  })
}

export function bookingReferences(tenantId: string, bookingIds: string[]) {
  if (!bookingIds.length) return Promise.resolve([])
  return prisma.booking.findMany({
    where: { tenantId, id: { in: bookingIds } },
    select: { id: true, bookingNumber: true },
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
