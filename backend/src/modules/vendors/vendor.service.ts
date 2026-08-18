import { randomUUID } from 'node:crypto'
import { Prisma } from '../../generated/prisma/client'
import { AppError } from '../../shared/errors/app-error'
import { pageResult } from '../../shared/pagination'
import { toTitleCase } from '../../shared/text/title-case'
import * as driverService from '../drivers/driver.service'
import * as vehicleService from '../vehicles/vehicle.service'
import { mapVendor, mapVendorDriver, mapVendorVehicle } from './vendor.mapper'
import * as repository from './vendor.repository'
import type {
  DriverInput,
  VehicleInput,
  VendorContext,
  VendorInput,
} from './vendor.types'
function conflict(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    throw new AppError('A duplicate vendor record exists', 'CONFLICT', 409)
  }
  throw error
}
async function vendorOrThrow(context: VendorContext, vendorId: string) {
  const vendor = await repository.find(context.tenantId, vendorId)
  if (!vendor) throw new AppError('Vendor was not found', 'NOT_FOUND', 404)
  return vendor
}
export async function listVendors(
  context: VendorContext,
  filters: repository.VendorFilters,
) {
  const [records, total] = await repository.list(context.tenantId, filters)
  return pageResult(
    records.map((vendor) => ({
      ...mapVendor(vendor),
      vehicles: vendor.vehicles.map(mapVendorVehicle),
      drivers: vendor.drivers.map(mapVendorDriver),
    })),
    total,
    filters,
  )
}
export async function getVendor(context: VendorContext, vendorId: string) {
  const vendor = await repository.find(context.tenantId, vendorId)
  if (!vendor) throw new AppError('Vendor was not found', 'NOT_FOUND', 404)
  return {
    ...mapVendor(vendor),
    vehicles: vendor.vehicles.map(mapVendorVehicle),
    drivers: vendor.drivers.map(mapVendorDriver),
  }
}
export async function createVendor(
  context: VendorContext,
  input: Required<Pick<VendorInput, 'name' | 'category' | 'phone' | 'city'>> &
    VendorInput,
) {
  try {
    const record = await repository.transaction(async (transaction) => {
      const vendor = await repository.create(transaction, {
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
      })
      await repository.audit(transaction, context, 'CREATE', vendor.id)
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
    const record = await repository.transaction(async (transaction) => {
      const vendor = await repository.update(transaction, vendorId, {
        ...input,
        ...(input.name ? { name: toTitleCase(input.name) } : {}),
        ...(input.category ? { category: toTitleCase(input.category) } : {}),
        ...(input.city ? { city: toTitleCase(input.city) } : {}),
        updatedById: context.userId,
      })
      await repository.audit(transaction, context, 'UPDATE', vendorId)
      return vendor
    })
    return {
      ...mapVendor(record),
      drivers: record.drivers.map(mapVendorDriver),
    }
  } catch (error) {
    return conflict(error)
  }
}
export async function deleteVendor(context: VendorContext, vendorId: string) {
  const vendor = await vendorOrThrow(context, vendorId)
  const children = await repository.countChildren(context.tenantId, vendorId)
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
  await repository.transaction(async (transaction) => {
    await repository.softDelete(transaction, vendorId, context.userId)
    await repository.audit(transaction, context, 'DELETE', vendorId)
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
  return mapVendorVehicle(
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
  return mapVendorVehicle(
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
  return mapVendorDriver(
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
  return mapVendorDriver(
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
