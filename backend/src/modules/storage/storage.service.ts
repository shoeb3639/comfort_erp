import { createHash, randomUUID } from 'node:crypto'
import { env } from '../../config/env'
import { logger } from '../../config/logger'
import { AppError } from '../../shared/errors/app-error'
import { DOCUMENT_TYPES, ENTITY_PERMISSION } from './storage.constants'
import { sanitizeOriginalFileName } from './file-name.util'
import { validateFileType } from './mime-type.util'
import { LocalStorageProvider } from './providers/local-storage.provider'
import type { StorageProvider } from './storage.interface'
import { buildStorageKey } from './storage-key.util'
import * as repository from './storage.repository'
import type {
  StorageContext,
  StorageEntityType,
  UploadRequest,
} from './storage.types'

const provider: StorageProvider = new LocalStorageProvider()

export async function storeWithCompensation<T>(
  storageProvider: StorageProvider,
  input: { storageKey: string; contents: Buffer },
  persistMetadata: () => Promise<T>,
  onCleanupFailure: (error: unknown) => void = () => undefined,
) {
  await storageProvider.upload(input)
  try {
    return await persistMetadata()
  } catch (error) {
    await storageProvider.delete(input.storageKey).catch(onCleanupFailure)
    throw error
  }
}

function metadata(file: Awaited<ReturnType<typeof repository.findActive>>) {
  if (!file) return null
  return {
    id: file.id,
    entityType: file.entityType,
    entityId: file.entityId,
    documentType: file.documentType,
    originalFileName: file.originalFileName,
    mimeType: file.mimeType,
    extension: file.extension,
    fileSize: Number(file.fileSize),
    checksum: file.checksum,
    createdAt: file.createdAt.toISOString(),
  }
}

function ensureEntityPermission(
  context: StorageContext,
  entityType: StorageEntityType,
) {
  if (!context.permissions.includes(ENTITY_PERMISSION[entityType]))
    throw new AppError('File access denied', 'FILE_ACCESS_DENIED', 403)
}

async function ensureOwnedEntity(
  context: StorageContext,
  entityType: StorageEntityType,
  entityId: string,
) {
  ensureEntityPermission(context, entityType)
  if (
    !(await repository.entityBelongsToTenant(
      context.tenantId,
      entityType,
      entityId,
    ))
  )
    throw new AppError('Entity was not found', 'ENTITY_NOT_FOUND', 404)
}

export async function upload(context: StorageContext, input: UploadRequest) {
  await ensureOwnedEntity(context, input.entityType, input.entityId)
  if (
    input.documentType &&
    !DOCUMENT_TYPES[input.entityType].includes(input.documentType)
  )
    throw new AppError('Invalid document type', 'INVALID_DOCUMENT_TYPE', 400)
  if (!input.contents.length)
    throw new AppError('Uploaded file is empty', 'INVALID_FILE_TYPE', 400)
  if (input.contents.length > env.storage.maxFileSizeBytes)
    throw new AppError('Uploaded file is too large', 'FILE_TOO_LARGE', 413)

  const originalFileName = sanitizeOriginalFileName(input.originalFileName)
  const { extension, mimeType } = validateFileType({
    fileName: originalFileName,
    mimeType: input.mimeType,
    contents: input.contents,
  })
  const id = randomUUID()
  const storedFileName = `${id}.${extension}`
  const invoice =
    input.entityType === 'INVOICE'
      ? await repository.getInvoiceFinancialYear(
          context.tenantId,
          input.entityId,
        )
      : null
  const storageKey = buildStorageKey({
    tenantId: context.tenantId,
    entityType: input.entityType,
    entityId: input.entityId,
    storedFileName,
    ...(invoice ? { financialYear: invoice.financialYear } : {}),
  })
  const checksum = createHash('sha256').update(input.contents).digest('hex')

  try {
    const file = await storeWithCompensation(
      provider,
      { storageKey, contents: input.contents },
      () =>
        repository.create(
          {
            id,
            tenantId: context.tenantId,
            entityType: input.entityType,
            entityId: input.entityId,
            documentType: input.documentType || null,
            originalFileName,
            storedFileName,
            storageProvider: 'LOCAL',
            storageKey,
            mimeType,
            extension,
            fileSize: input.contents.length,
            checksum,
            uploadedById: context.userId,
          },
          context.userId,
        ),
      (cleanupError) =>
        logger.error('FILE_UPLOAD_CLEANUP_FAILED', {
          tenantId: context.tenantId,
          fileId: id,
          error:
            cleanupError instanceof Error ? cleanupError.message : 'unknown',
        }),
    )
    logger.info('FILE_UPLOADED', {
      tenantId: context.tenantId,
      userId: context.userId,
      fileId: id,
      entityType: input.entityType,
      entityId: input.entityId,
      fileSize: input.contents.length,
    })
    return metadata(file)!
  } catch (error) {
    logger.error('FILE_UPLOAD_FAILED', {
      tenantId: context.tenantId,
      userId: context.userId,
      entityType: input.entityType,
      entityId: input.entityId,
      error: error instanceof Error ? error.message : 'unknown',
    })
    throw error
  }
}

export async function get(context: StorageContext, fileId: string) {
  const file = await repository.findActive(context.tenantId, fileId)
  if (!file) throw new AppError('File was not found', 'FILE_NOT_FOUND', 404)
  await ensureOwnedEntity(
    context,
    file.entityType as StorageEntityType,
    file.entityId,
  )
  return file
}

export async function open(context: StorageContext, fileId: string) {
  const file = await get(context, fileId)
  try {
    const contents = await provider.getFile(file.storageKey)
    logger.info('FILE_DOWNLOADED', {
      tenantId: context.tenantId,
      userId: context.userId,
      fileId,
      entityType: file.entityType,
      entityId: file.entityId,
    })
    return { file, ...contents }
  } catch (error) {
    logger.error('FILE_DOWNLOAD_FAILED', {
      tenantId: context.tenantId,
      userId: context.userId,
      fileId,
      error: error instanceof Error ? error.message : 'unknown',
    })
    throw error
  }
}

export async function list(
  context: StorageContext,
  filters: { entityType?: string; entityId?: string; documentType?: string },
) {
  if (filters.entityType && filters.entityId)
    await ensureOwnedEntity(
      context,
      filters.entityType as StorageEntityType,
      filters.entityId,
    )
  const files = await repository.listActive(context.tenantId, filters)
  return files
    .filter((file) =>
      context.permissions.includes(
        ENTITY_PERMISSION[file.entityType as StorageEntityType],
      ),
    )
    .map((file) => metadata(file)!)
}

export async function remove(context: StorageContext, fileId: string) {
  const file = await get(context, fileId)
  if (file.entityType === 'INVOICE' && file.documentType === 'FINAL_PDF')
    throw new AppError(
      'Final invoice documents are immutable',
      'IMMUTABLE_DOCUMENT',
      409,
    )
  const deleted = await repository.softDelete(
    context.tenantId,
    fileId,
    context.userId,
  )
  if (!deleted) throw new AppError('File was not found', 'FILE_NOT_FOUND', 404)
  logger.info('FILE_DELETED', {
    tenantId: context.tenantId,
    userId: context.userId,
    fileId,
    entityType: file.entityType,
    entityId: file.entityId,
  })
  return metadata(deleted)!
}

export async function getTenantStorageUsage(tenantId: string) {
  return Number(await repository.storageUsage(tenantId))
}

export async function purge(context: StorageContext, fileId: string) {
  const file = await repository.findAny(context.tenantId, fileId)
  if (!file) throw new AppError('File was not found', 'FILE_NOT_FOUND', 404)
  if (file.entityType === 'INVOICE' && file.documentType === 'FINAL_PDF')
    throw new AppError(
      'Final invoice documents cannot be purged',
      'IMMUTABLE_DOCUMENT',
      409,
    )
  await provider.delete(file.storageKey)
  await repository.purgeMetadata(context.tenantId, file.id, context.userId)
  logger.info('FILE_PURGED', {
    tenantId: context.tenantId,
    userId: context.userId,
    fileId,
  })
}
