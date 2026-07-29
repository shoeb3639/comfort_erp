import { randomUUID } from 'node:crypto'
import type {
  Prisma,
  SetupRecordStatus,
  VehicleOwnershipType,
} from '../../generated/prisma/client'
import { prisma } from '../../config/prisma'
import { AppError } from '../../shared/errors/app-error'
import { toTitleCase } from '../../shared/text/title-case'
import * as repository from './vehicle.repository'

export interface VehicleContext {
  tenantId: string
  userId: string
}

export interface VehicleInput {
  ownershipType?: VehicleOwnershipType
  vendorId?: string | null
  registrationNumber?: string
  vehicleTypeId?: string
  vehicleType?: string
  make?: string | null
  model?: string | null
  variant?: string | null
  fuelType?: string | null
  manufacturingYear?: number | null
  registrationDate?: string | Date | null
  insuranceExpiry?: string | Date | null
  permitExpiry?: string | Date | null
  fitnessExpiry?: string | Date | null
  seatingCapacity?: number | null
  status?: SetupRecordStatus
}

function date(value: string | Date | null | undefined) {
  if (value === null) return null
  if (value === undefined) return undefined

  const parsed =
    value instanceof Date
      ? new Date(
          Date.UTC(
            value.getUTCFullYear(),
            value.getUTCMonth(),
            value.getUTCDate(),
          ),
        )
      : new Date(`${value.slice(0, 10)}T00:00:00.000Z`)

  if (Number.isNaN(parsed.getTime())) {
    throw new AppError('Vehicle date is invalid', 'VALIDATION_ERROR', 400)
  }
  return parsed
}

function normalizeRegistration(value: string) {
  return value.replace(/[\s-]+/g, '').toUpperCase()
}

function conflict(error: unknown): never {
  if (
    error instanceof Error &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  ) {
    throw new AppError(
      'Registration number already exists for this tenant',
      'CONFLICT',
      409,
    )
  }
  throw error
}

async function validateVendor(
  context: VehicleContext,
  ownershipType: VehicleOwnershipType,
  vendorId: string | null | undefined,
) {
  if (ownershipType === 'OWN' && vendorId) {
    throw new AppError(
      'Own vehicles cannot be linked to a vendor',
      'VALIDATION_ERROR',
      400,
    )
  }
  if (ownershipType === 'VENDOR' && !vendorId) {
    throw new AppError(
      'Vendor is required for vendor vehicles',
      'VALIDATION_ERROR',
      400,
    )
  }
  if (vendorId && !(await repository.findVendor(context.tenantId, vendorId))) {
    throw new AppError('Vendor was not found', 'NOT_FOUND', 404)
  }
}

async function resolveType(
  context: VehicleContext,
  input: VehicleInput,
  allowCreate = false,
) {
  if (input.vehicleTypeId) {
    const type = await repository.findType(
      context.tenantId,
      input.vehicleTypeId,
    )
    if (!type)
      throw new AppError('Vehicle type was not found', 'NOT_FOUND', 404)
    return type.id
  }
  if (input.vehicleType && allowCreate) {
    const name = toTitleCase(input.vehicleType)
    return (
      (await repository.findTypeByName(context.tenantId, name)) ??
      (await repository.createType(context.tenantId, name))
    ).id
  }
  return undefined
}

async function audit(
  transaction: Prisma.TransactionClient,
  context: VehicleContext,
  action: string,
  referenceId: string,
) {
  await transaction.tenantAuditLog.create({
    data: {
      tenantId: context.tenantId,
      actorUserId: context.userId,
      module: 'VEHICLE',
      action,
      referenceId,
    },
  })
}

export async function listVehicles(
  context: VehicleContext,
  filters: repository.VehicleFilters,
) {
  if (filters.ownershipType === 'OWN' && filters.vendorId) {
    throw new AppError(
      'vendorId cannot be combined with ownershipType OWN',
      'VALIDATION_ERROR',
      400,
    )
  }
  if (
    filters.vendorId &&
    !(await repository.findVendor(context.tenantId, filters.vendorId))
  ) {
    throw new AppError('Vendor was not found', 'NOT_FOUND', 404)
  }
  return repository.list(context.tenantId, filters)
}

export async function getVehicle(context: VehicleContext, id: string) {
  const record = await repository.find(context.tenantId, id)
  if (!record) throw new AppError('Vehicle was not found', 'NOT_FOUND', 404)
  return record
}

export const listVehicleTypes = (context: VehicleContext) =>
  repository.listTypes(context.tenantId)

export async function createVehicleType(
  context: VehicleContext,
  input: { name: string },
) {
  const name = toTitleCase(input.name)
  return (
    (await repository.findTypeByName(context.tenantId, name)) ??
    (await repository.createType(context.tenantId, name))
  )
}

export async function createVehicle(
  context: VehicleContext,
  input: VehicleInput,
  forced?: { ownershipType: 'VENDOR'; vendorId: string },
) {
  const ownershipType = forced?.ownershipType ?? input.ownershipType
  const vendorId = forced?.vendorId ?? input.vendorId
  if (!ownershipType) {
    throw new AppError('Ownership type is required', 'VALIDATION_ERROR', 400)
  }
  await validateVendor(context, ownershipType, vendorId)
  const vehicleTypeId = await resolveType(context, input, Boolean(forced))
  if (!vehicleTypeId) {
    throw new AppError('Vehicle type is required', 'VALIDATION_ERROR', 400)
  }
  if (!input.registrationNumber) {
    throw new AppError(
      'Registration number is required',
      'VALIDATION_ERROR',
      400,
    )
  }
  try {
    return await prisma.$transaction(async (transaction) => {
      const record = await repository.create(transaction, {
        tenantId: context.tenantId,
        ownershipType,
        vendorId: ownershipType === 'OWN' ? null : vendorId!,
        vehicleCode: `VEH-${randomUUID().slice(0, 8).toUpperCase()}`,
        registrationNumber: normalizeRegistration(input.registrationNumber!),
        vehicleTypeId,
        make: input.make ? toTitleCase(input.make) : null,
        model: input.model ? toTitleCase(input.model) : null,
        variant: input.variant ? toTitleCase(input.variant) : null,
        fuelType: input.fuelType ? toTitleCase(input.fuelType) : null,
        manufacturingYear: input.manufacturingYear ?? null,
        registrationDate: date(input.registrationDate) ?? null,
        insuranceExpiry: date(input.insuranceExpiry) ?? null,
        permitExpiry: date(input.permitExpiry) ?? null,
        fitnessExpiry: date(input.fitnessExpiry) ?? null,
        seatingCapacity: input.seatingCapacity ?? null,
        status: input.status ?? 'ACTIVE',
        createdById: context.userId,
        updatedById: context.userId,
      })
      await audit(transaction, context, 'CREATE', record.id)
      return record
    })
  } catch (error) {
    return conflict(error)
  }
}

export async function updateVehicle(
  context: VehicleContext,
  id: string,
  input: VehicleInput,
  forcedVendorId?: string,
) {
  const existing = await getVehicle(context, id)
  if (forcedVendorId && existing.vendorId !== forcedVendorId) {
    throw new AppError('Vehicle was not found', 'NOT_FOUND', 404)
  }
  const ownershipType = forcedVendorId
    ? 'VENDOR'
    : (input.ownershipType ?? existing.ownershipType)
  const vendorId = forcedVendorId
    ? forcedVendorId
    : input.vendorId !== undefined
      ? input.vendorId
      : existing.vendorId
  await validateVendor(context, ownershipType, vendorId)
  const vehicleTypeId = await resolveType(
    context,
    input,
    Boolean(forcedVendorId),
  )
  try {
    return await prisma.$transaction(async (transaction) => {
      const record = await repository.update(transaction, id, {
        ownershipType,
        vendorId: ownershipType === 'OWN' ? null : vendorId,
        ...(input.registrationNumber
          ? {
              registrationNumber: normalizeRegistration(
                input.registrationNumber,
              ),
            }
          : {}),
        ...(vehicleTypeId ? { vehicleTypeId } : {}),
        ...(input.make !== undefined
          ? { make: input.make ? toTitleCase(input.make) : null }
          : {}),
        ...(input.model !== undefined
          ? { model: input.model ? toTitleCase(input.model) : null }
          : {}),
        ...(input.variant !== undefined
          ? { variant: input.variant ? toTitleCase(input.variant) : null }
          : {}),
        ...(input.fuelType !== undefined
          ? {
              fuelType: input.fuelType ? toTitleCase(input.fuelType) : null,
            }
          : {}),
        ...(input.manufacturingYear !== undefined
          ? { manufacturingYear: input.manufacturingYear }
          : {}),
        ...(input.registrationDate !== undefined
          ? { registrationDate: date(input.registrationDate)! }
          : {}),
        ...(input.insuranceExpiry !== undefined
          ? { insuranceExpiry: date(input.insuranceExpiry)! }
          : {}),
        ...(input.permitExpiry !== undefined
          ? { permitExpiry: date(input.permitExpiry)! }
          : {}),
        ...(input.fitnessExpiry !== undefined
          ? { fitnessExpiry: date(input.fitnessExpiry)! }
          : {}),
        ...(input.seatingCapacity !== undefined
          ? { seatingCapacity: input.seatingCapacity }
          : {}),
        ...(input.status ? { status: input.status } : {}),
        updatedById: context.userId,
      })
      await audit(transaction, context, 'UPDATE', id)
      return record
    })
  } catch (error) {
    return conflict(error)
  }
}

export async function deleteVehicle(context: VehicleContext, id: string) {
  await getVehicle(context, id)
  await prisma.$transaction(async (transaction) => {
    await repository.update(transaction, id, {
      deletedAt: new Date(),
      deletedById: context.userId,
      status: 'INACTIVE',
    })
    await audit(transaction, context, 'DELETE', id)
  })
  return { id, deleted: true }
}
