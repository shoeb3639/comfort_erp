import type { Prisma } from '../../generated/prisma/client'
import { prisma } from '../../config/prisma'
import { AppError } from '../../shared/errors/app-error'
import type { StorageEntityType } from './storage.types'

export async function entityBelongsToTenant(
  tenantId: string,
  entityType: StorageEntityType,
  entityId: string,
) {
  switch (entityType) {
    case 'COMPANY':
      if (entityId !== tenantId) return false
      return Boolean(
        await prisma.tenant.findUnique({
          where: { id: tenantId },
          select: { id: true },
        }),
      )
    case 'CUSTOMER':
      return Boolean(
        await prisma.customer.findFirst({
          where: { id: entityId, tenantId, deletedAt: null },
          select: { id: true },
        }),
      )
    case 'VENDOR':
      return Boolean(
        await prisma.vendor.findFirst({
          where: { id: entityId, tenantId, deletedAt: null },
          select: { id: true },
        }),
      )
    case 'VEHICLE':
      return Boolean(
        await prisma.vehicle.findFirst({
          where: { id: entityId, tenantId, deletedAt: null },
          select: { id: true },
        }),
      )
    case 'DRIVER':
      return Boolean(
        await prisma.driver.findFirst({
          where: { id: entityId, tenantId, deletedAt: null },
          select: { id: true },
        }),
      )
    case 'BOOKING':
      return Boolean(
        await prisma.booking.findFirst({
          where: { id: entityId, tenantId, deletedAt: null },
          select: { id: true },
        }),
      )
    case 'INVOICE':
      return Boolean(
        await prisma.invoice.findFirst({
          where: { id: entityId, tenantId },
          select: { id: true },
        }),
      )
    case 'RECEIPT':
      return Boolean(
        await prisma.bookingCollection.findFirst({
          where: { id: entityId, tenantId },
          select: { id: true },
        }),
      )
  }
}

export function getInvoiceFinancialYear(tenantId: string, invoiceId: string) {
  return prisma.invoice.findFirst({
    where: { tenantId, id: invoiceId },
    select: { financialYear: true },
  })
}

export function create(
  data: Prisma.StoredFileUncheckedCreateInput,
  actorUserId: string,
) {
  return prisma.$transaction(async (transaction) => {
    const file = await transaction.storedFile.create({ data })
    await transaction.tenantAuditLog.create({
      data: {
        tenantId: file.tenantId,
        actorUserId,
        module: 'FILE',
        action: 'UPLOAD',
        referenceId: file.id,
        newValues: {
          entityType: file.entityType,
          entityId: file.entityId,
          documentType: file.documentType,
          fileSize: file.fileSize.toString(),
        },
      },
    })
    return file
  })
}

export function findActive(tenantId: string, id: string) {
  return prisma.storedFile.findFirst({
    where: { tenantId, id, deletedAt: null },
  })
}

export function findAny(tenantId: string, id: string) {
  return prisma.storedFile.findFirst({ where: { tenantId, id } })
}

export function listActive(
  tenantId: string,
  filters: { entityType?: string; entityId?: string; documentType?: string },
) {
  return prisma.storedFile.findMany({
    where: { tenantId, deletedAt: null, ...filters },
    orderBy: { createdAt: 'desc' },
  })
}

export function softDelete(tenantId: string, id: string, actorUserId: string) {
  return prisma.$transaction(async (transaction) => {
    const result = await transaction.storedFile.updateMany({
      where: { tenantId, id, deletedAt: null },
      data: { deletedAt: new Date(), deletedById: actorUserId },
    })
    if (!result.count) return null
    if (
      await transaction.bookingCollection.count({
        where: { tenantId, fuelReceiptId: id },
      })
    )
      throw new AppError(
        'Fuel receipts linked to collections must be retained for audit',
        'IMMUTABLE_DOCUMENT',
        409,
      )
    const file = await transaction.storedFile.findUniqueOrThrow({
      where: { tenantId_id: { tenantId, id } },
    })
    await transaction.tenantAuditLog.create({
      data: {
        tenantId,
        actorUserId,
        module: 'FILE',
        action: 'DELETE',
        referenceId: id,
        oldValues: { entityType: file.entityType, entityId: file.entityId },
      },
    })
    return file
  })
}

export async function storageUsage(tenantId: string) {
  const result = await prisma.storedFile.aggregate({
    where: { tenantId, deletedAt: null },
    _sum: { fileSize: true },
  })
  return result._sum.fileSize ?? 0n
}

export function purgeMetadata(
  tenantId: string,
  id: string,
  actorUserId: string,
) {
  return prisma.$transaction(async (transaction) => {
    const file = await transaction.storedFile.findUniqueOrThrow({
      where: { tenantId_id: { tenantId, id } },
    })
    await transaction.tenantAuditLog.create({
      data: {
        tenantId,
        actorUserId,
        module: 'FILE',
        action: 'PURGE',
        referenceId: id,
        oldValues: {
          entityType: file.entityType,
          entityId: file.entityId,
          documentType: file.documentType,
          fileSize: file.fileSize.toString(),
        },
      },
    })
    return transaction.storedFile.delete({
      where: { tenantId_id: { tenantId, id } },
    })
  })
}
