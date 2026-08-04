import { randomUUID } from 'node:crypto'
import { Prisma } from '../../generated/prisma/client'
import type { Salutation } from '../../generated/prisma/enums'
import { prisma } from '../../config/prisma'
import { AppError } from '../../shared/errors/app-error'
import type { PageRequest } from '../../shared/pagination'
import { pageResult, pageWindow } from '../../shared/pagination'
import { toTitleCase } from '../../shared/text/title-case'
import * as driverService from '../drivers/driver.service'
import * as vehicleService from '../vehicles/vehicle.service'

export interface VendorContext {
  tenantId: string
  userId: string
}
export interface VendorInput {
  name?: string
  recordType?: string
  category?: string
  rating?: number
  phone?: string
  city?: string
  status?: 'ACTIVE' | 'INACTIVE'
}
export interface VehicleInput {
  plate?: string
  type?: string
  status?: string
  make?: string
  seatingCapacity?: number
}
export interface DriverInput {
  salutation?: Salutation | null
  name?: string
  license?: string
  status?: string
  phone?: string
  city?: string
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

function mapVendor<T extends { rating: Prisma.Decimal }>(vendor: T) {
  return { ...vendor, rating: vendor.rating.toNumber() }
}
function displayDriver<
  T extends {
    name: string
    salutation: Salutation | null
    mobile?: string
    licenceNumber?: string | null
    address?: string | null
  },
>(driver: T) {
  return {
    ...driver,
    ...(driver.mobile !== undefined ? { phone: driver.mobile } : {}),
    ...(driver.licenceNumber !== undefined
      ? { license: driver.licenceNumber }
      : {}),
    ...(driver.address !== undefined ? { city: driver.address } : {}),
    displayName: `${driver.salutation === 'MR' ? 'Mr. ' : driver.salutation === 'MS' ? 'Ms. ' : ''}${driver.name}`,
  }
}
function displayVehicle<
  T extends {
    registrationNumber: string
    vehicleType?: { name: string }
  },
>(vehicle: T) {
  return {
    ...vehicle,
    plate: vehicle.registrationNumber,
    ...(vehicle.vehicleType ? { type: vehicle.vehicleType.name } : {}),
  }
}
function conflict(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    throw new AppError('A duplicate vendor record exists', 'CONFLICT', 409)
  }
  throw error
}
async function audit(
  transaction: Prisma.TransactionClient,
  context: VendorContext,
  action: string,
  referenceId: string,
) {
  await transaction.tenantAuditLog.create({
    data: {
      tenantId: context.tenantId,
      actorUserId: context.userId,
      module: 'VENDOR',
      action,
      referenceId,
    },
  })
}
async function vendorOrThrow(context: VendorContext, vendorId: string) {
  const vendor = await prisma.vendor.findFirst({
    where: { tenantId: context.tenantId, id: vendorId, deletedAt: null },
  })
  if (!vendor) throw new AppError('Vendor was not found', 'NOT_FOUND', 404)
  return vendor
}
export async function listVendors(
  context: VendorContext,
  filters: {
    search?: string
    recordType?: string
    status?: 'ACTIVE' | 'INACTIVE'
  } & PageRequest,
) {
  const where = {
    tenantId: context.tenantId,
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
  const [records, total] = await Promise.all([
    prisma.vendor.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include,
      ...pageWindow(filters),
    }),
    prisma.vendor.count({ where }),
  ])
  return pageResult(
    records.map((vendor) => ({
      ...mapVendor(vendor),
      vehicles: vendor.vehicles.map(displayVehicle),
      drivers: vendor.drivers.map(displayDriver),
    })),
    total,
    filters,
  )
}
export async function getVendor(context: VendorContext, vendorId: string) {
  const vendor = await prisma.vendor.findFirst({
    where: { tenantId: context.tenantId, id: vendorId, deletedAt: null },
    include,
  })
  if (!vendor) throw new AppError('Vendor was not found', 'NOT_FOUND', 404)
  return {
    ...mapVendor(vendor),
    vehicles: vendor.vehicles.map(displayVehicle),
    drivers: vendor.drivers.map(displayDriver),
  }
}
export async function createVendor(
  context: VendorContext,
  input: Required<Pick<VendorInput, 'name' | 'category' | 'phone' | 'city'>> &
    VendorInput,
) {
  try {
    const record = await prisma.$transaction(async (transaction) => {
      const vendor = await transaction.vendor.create({
        data: {
          tenantId: context.tenantId,
          vendorCode: `VEN-${randomUUID().slice(0, 8).toUpperCase()}`,
          name: toTitleCase(input.name),
          recordType: input.recordType ?? 'external_vendor',
          category: toTitleCase(input.category),
          rating: input.rating ?? 0,
          phone: input.phone,
          city: toTitleCase(input.city),
          status: input.status ?? 'ACTIVE',
          createdById: context.userId,
          updatedById: context.userId,
        },
      })
      await audit(transaction, context, 'CREATE', vendor.id)
      return vendor
    })
    return mapVendor({ ...record, vehicles: [], drivers: [] })
  } catch (error) {
    return conflict(error)
  }
}
export async function updateVendor(
  context: VendorContext,
  vendorId: string,
  input: VendorInput,
) {
  await vendorOrThrow(context, vendorId)
  try {
    const record = await prisma.$transaction(async (transaction) => {
      const vendor = await transaction.vendor.update({
        where: { id: vendorId },
        data: {
          ...input,
          ...(input.name ? { name: toTitleCase(input.name) } : {}),
          ...(input.category ? { category: toTitleCase(input.category) } : {}),
          ...(input.city ? { city: toTitleCase(input.city) } : {}),
          updatedById: context.userId,
        },
        include,
      })
      await audit(transaction, context, 'UPDATE', vendorId)
      return vendor
    })
    return { ...mapVendor(record), drivers: record.drivers.map(displayDriver) }
  } catch (error) {
    return conflict(error)
  }
}
export async function deleteVendor(context: VendorContext, vendorId: string) {
  const vendor = await vendorOrThrow(context, vendorId)
  const children = await prisma.$transaction([
    prisma.vehicle.count({
      where: { tenantId: context.tenantId, vendorId, deletedAt: null },
    }),
    prisma.driver.count({
      where: { tenantId: context.tenantId, vendorId, deletedAt: null },
    }),
  ])
  if (children[0] + children[1] > 0) {
    throw new AppError(
      'Delete linked vehicles and drivers first',
      'VENDOR_HAS_CHILDREN',
      409,
    )
  }
  if (vendor.recordType === 'own_company') {
    throw new AppError(
      'Own company record cannot be deleted',
      'PROTECTED_RECORD',
      409,
    )
  }
  await prisma.$transaction(async (transaction) => {
    await transaction.vendor.update({
      where: { id: vendorId },
      data: {
        deletedAt: new Date(),
        deletedById: context.userId,
        status: 'INACTIVE',
      },
    })
    await audit(transaction, context, 'DELETE', vendorId)
  })
  return { id: vendorId, deleted: true }
}

export async function createVehicle(
  context: VendorContext,
  vendorId: string,
  input: Required<
    Pick<VehicleInput, 'plate' | 'type' | 'make' | 'seatingCapacity'>
  > &
    VehicleInput,
) {
  await vendorOrThrow(context, vendorId)
  return displayVehicle(
    await vehicleService.createVehicle(
      context,
      {
        registrationNumber: input.plate,
        vehicleType: input.type,
        make: input.make,
        seatingCapacity: input.seatingCapacity,
        status: input.status === 'Maintenance' ? 'INACTIVE' : 'ACTIVE',
      },
      { ownershipType: 'VENDOR', vendorId },
    ),
  )
}
export async function updateVehicle(
  context: VendorContext,
  vendorId: string,
  childId: string,
  input: VehicleInput,
) {
  await vendorOrThrow(context, vendorId)
  return displayVehicle(
    await vehicleService.updateVehicle(
      context,
      childId,
      {
        ...(input.plate ? { registrationNumber: input.plate } : {}),
        ...(input.type ? { vehicleType: input.type } : {}),
        ...(input.make ? { make: input.make } : {}),
        ...(input.seatingCapacity !== undefined
          ? { seatingCapacity: input.seatingCapacity }
          : {}),
        ...(input.status
          ? { status: input.status === 'Maintenance' ? 'INACTIVE' : 'ACTIVE' }
          : {}),
      },
      vendorId,
    ),
  )
}
export async function deleteVehicle(
  context: VendorContext,
  vendorId: string,
  childId: string,
) {
  const record = await vehicleService.getVehicle(context, childId)
  if (record.vendorId !== vendorId)
    throw new AppError('Vehicle was not found', 'NOT_FOUND', 404)
  return vehicleService.deleteVehicle(context, childId)
}
export async function createDriver(
  context: VendorContext,
  vendorId: string,
  input: Required<Pick<DriverInput, 'name' | 'license' | 'phone' | 'city'>> &
    DriverInput,
) {
  await vendorOrThrow(context, vendorId)
  return displayDriver(
    await driverService.createDriver(
      context,
      {
        ...(input.salutation !== undefined
          ? { salutation: input.salutation }
          : {}),
        name: input.name,
        licenceNumber: input.license,
        mobile: input.phone,
        address: input.city,
        status: input.status === 'Offline' ? 'INACTIVE' : 'ACTIVE',
      },
      { engagementType: 'VENDOR', vendorId },
    ),
  )
}
export async function updateDriver(
  context: VendorContext,
  vendorId: string,
  childId: string,
  input: DriverInput,
) {
  await vendorOrThrow(context, vendorId)
  return displayDriver(
    await driverService.updateDriver(
      context,
      childId,
      {
        ...(input.salutation !== undefined
          ? { salutation: input.salutation }
          : {}),
        ...(input.name ? { name: input.name } : {}),
        ...(input.license ? { licenceNumber: input.license } : {}),
        ...(input.phone ? { mobile: input.phone } : {}),
        ...(input.city ? { address: input.city } : {}),
        ...(input.status
          ? { status: input.status === 'Offline' ? 'INACTIVE' : 'ACTIVE' }
          : {}),
      },
      vendorId,
    ),
  )
}
export async function deleteDriver(
  context: VendorContext,
  vendorId: string,
  childId: string,
) {
  const record = await driverService.getDriver(context, childId)
  if (record.vendorId !== vendorId)
    throw new AppError('Driver was not found', 'NOT_FOUND', 404)
  return driverService.deleteDriver(context, childId)
}
