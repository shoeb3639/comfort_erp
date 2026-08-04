import { randomUUID } from 'node:crypto'
import type {
  DriverEngagementType,
  Prisma,
  Salutation,
  SetupRecordStatus,
} from '../../generated/prisma/client'
import { prisma } from '../../config/prisma'
import { AppError } from '../../shared/errors/app-error'
import { pageResult } from '../../shared/pagination'
import { toTitleCase } from '../../shared/text/title-case'
import * as repository from './driver.repository'

export interface DriverContext {
  tenantId: string
  userId: string
}
export interface DriverInput {
  engagementType?: DriverEngagementType
  vendorId?: string | null
  salutation?: Salutation | null
  name?: string
  mobile?: string
  alternateMobile?: string | null
  licenceNumber?: string | null
  licenceType?: string | null
  licenceExpiry?: string | null
  address?: string | null
  identityDetails?: Prisma.InputJsonValue | null
  status?: SetupRecordStatus
}
function date(value: string | null | undefined) {
  return value
    ? new Date(`${value}T00:00:00.000Z`)
    : value === null
      ? null
      : undefined
}
function display<T extends { name: string; salutation: Salutation | null }>(
  driver: T,
) {
  return {
    ...driver,
    displayName: `${driver.salutation === 'MR' ? 'Mr. ' : driver.salutation === 'MS' ? 'Ms. ' : ''}${driver.name}`,
  }
}
function conflict(error: unknown): never {
  if (
    error instanceof Error &&
    'code' in error &&
    (error as { code?: string }).code === 'P2002'
  )
    throw new AppError(
      'Licence number already exists for this tenant',
      'CONFLICT',
      409,
    )
  throw error
}
async function validateVendor(
  context: DriverContext,
  engagementType: DriverEngagementType,
  vendorId: string | null | undefined,
) {
  if (engagementType === 'OWN' && vendorId)
    throw new AppError(
      'Own drivers cannot be linked to a vendor',
      'VALIDATION_ERROR',
      400,
    )
  if (engagementType === 'VENDOR' && !vendorId)
    throw new AppError(
      'Vendor is required for vendor drivers',
      'VALIDATION_ERROR',
      400,
    )
  if (vendorId && !(await repository.findVendor(context.tenantId, vendorId)))
    throw new AppError('Vendor was not found', 'NOT_FOUND', 404)
}
async function audit(
  transaction: Prisma.TransactionClient,
  context: DriverContext,
  action: string,
  id: string,
) {
  await transaction.tenantAuditLog.create({
    data: {
      tenantId: context.tenantId,
      actorUserId: context.userId,
      module: 'DRIVER',
      action,
      referenceId: id,
    },
  })
}
export async function listDrivers(
  context: DriverContext,
  filters: repository.DriverFilters,
) {
  if (filters.engagementType === 'OWN' && filters.vendorId)
    throw new AppError(
      'vendorId cannot be combined with engagementType OWN',
      'VALIDATION_ERROR',
      400,
    )
  if (
    filters.vendorId &&
    !(await repository.findVendor(context.tenantId, filters.vendorId))
  )
    throw new AppError('Vendor was not found', 'NOT_FOUND', 404)
  const [records, total] = await repository.list(context.tenantId, filters)
  return pageResult(records.map(display), total, filters)
}
export async function getDriver(context: DriverContext, id: string) {
  const record = await repository.find(context.tenantId, id)
  if (!record) throw new AppError('Driver was not found', 'NOT_FOUND', 404)
  return display(record)
}
export async function createDriver(
  context: DriverContext,
  input: DriverInput,
  forced?: { engagementType: 'VENDOR'; vendorId: string },
) {
  const engagementType = forced?.engagementType ?? input.engagementType
  const vendorId = forced?.vendorId ?? input.vendorId
  if (!engagementType)
    throw new AppError('Engagement type is required', 'VALIDATION_ERROR', 400)
  if (!input.name || !input.mobile)
    throw new AppError('Name and mobile are required', 'VALIDATION_ERROR', 400)
  await validateVendor(context, engagementType, vendorId)
  try {
    const record = await prisma.$transaction(async (transaction) => {
      const created = await repository.create(transaction, {
        tenantId: context.tenantId,
        engagementType,
        vendorId: engagementType === 'OWN' ? null : vendorId!,
        driverCode: `DRV-${randomUUID().slice(0, 8).toUpperCase()}`,
        salutation: input.salutation ?? null,
        name: toTitleCase(input.name!),
        mobile: input.mobile!,
        alternateMobile: input.alternateMobile ?? null,
        licenceNumber: input.licenceNumber?.toUpperCase() || null,
        licenceType: input.licenceType ? toTitleCase(input.licenceType) : null,
        licenceExpiry: date(input.licenceExpiry) ?? null,
        address: input.address ? toTitleCase(input.address) : null,
        ...(input.identityDetails !== undefined &&
        input.identityDetails !== null
          ? { identityDetails: input.identityDetails }
          : {}),
        status: input.status ?? 'ACTIVE',
        createdById: context.userId,
        updatedById: context.userId,
      })
      await audit(transaction, context, 'CREATE', created.id)
      return created
    })
    return display(record)
  } catch (error) {
    return conflict(error)
  }
}
export async function updateDriver(
  context: DriverContext,
  id: string,
  input: DriverInput,
  forcedVendorId?: string,
) {
  const existing = await getDriver(context, id)
  if (forcedVendorId && existing.vendorId !== forcedVendorId)
    throw new AppError('Driver was not found', 'NOT_FOUND', 404)
  const engagementType = forcedVendorId
    ? 'VENDOR'
    : (input.engagementType ?? existing.engagementType)
  const vendorId = forcedVendorId
    ? forcedVendorId
    : input.vendorId !== undefined
      ? input.vendorId
      : existing.vendorId
  await validateVendor(context, engagementType, vendorId)
  try {
    const record = await prisma.$transaction(async (transaction) => {
      const updated = await repository.update(transaction, id, {
        engagementType,
        vendorId: engagementType === 'OWN' ? null : vendorId,
        ...(input.salutation !== undefined
          ? { salutation: input.salutation }
          : {}),
        ...(input.name ? { name: toTitleCase(input.name) } : {}),
        ...(input.mobile ? { mobile: input.mobile } : {}),
        ...(input.alternateMobile !== undefined
          ? { alternateMobile: input.alternateMobile }
          : {}),
        ...(input.licenceNumber !== undefined
          ? {
              licenceNumber: input.licenceNumber?.toUpperCase() || null,
            }
          : {}),
        ...(input.licenceType !== undefined
          ? {
              licenceType: input.licenceType
                ? toTitleCase(input.licenceType)
                : null,
            }
          : {}),
        ...(input.licenceExpiry !== undefined
          ? { licenceExpiry: date(input.licenceExpiry)! }
          : {}),
        ...(input.address !== undefined
          ? { address: input.address ? toTitleCase(input.address) : null }
          : {}),
        ...(input.identityDetails !== undefined
          ? {
              identityDetails:
                input.identityDetails === null
                  ? { unset: true }
                  : input.identityDetails,
            }
          : {}),
        ...(input.status ? { status: input.status } : {}),
        updatedById: context.userId,
      })
      await audit(transaction, context, 'UPDATE', id)
      return updated
    })
    return display(record)
  } catch (error) {
    return conflict(error)
  }
}
export async function deleteDriver(context: DriverContext, id: string) {
  await getDriver(context, id)
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
