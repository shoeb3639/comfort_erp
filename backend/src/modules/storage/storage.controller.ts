import type { RequestHandler } from 'express'
import { AppError } from '../../shared/errors/app-error'
import type { StorageContext, StorageEntityType } from './storage.types'
import * as service from './storage.service'

function context(request: Parameters<RequestHandler>[0]): StorageContext {
  if (!request.auth?.tenantId || !request.tenant)
    throw new AppError('Tenant context is required', 'UNAUTHORIZED', 401)
  return {
    tenantId: request.auth.tenantId,
    userId: request.auth.userId,
    permissions: request.auth.permissions,
  }
}

function fileId(request: Parameters<RequestHandler>[0]) {
  return String(request.params.fileId)
}

export const upload: RequestHandler = async (request, response) => {
  if (!request.file)
    throw new AppError('A file is required', 'INVALID_FILE_TYPE', 400)
  const body = request.body as {
    entityType: StorageEntityType
    entityId: string
    documentType?: string | null
  }
  const file = await service.upload(context(request), {
    entityType: body.entityType,
    entityId: body.entityId,
    ...(body.documentType !== undefined
      ? { documentType: body.documentType }
      : {}),
    originalFileName: request.file.originalname,
    mimeType: request.file.mimetype,
    contents: request.file.buffer,
  })
  response
    .status(201)
    .json({ success: true, data: file, message: 'File uploaded' })
}

export const list: RequestHandler = async (request, response) =>
  response.json({
    success: true,
    data: await service.list(context(request), {
      ...(typeof request.query.entityType === 'string'
        ? { entityType: request.query.entityType }
        : {}),
      ...(typeof request.query.entityId === 'string'
        ? { entityId: request.query.entityId }
        : {}),
      ...(typeof request.query.documentType === 'string'
        ? { documentType: request.query.documentType }
        : {}),
    }),
    message: 'Files retrieved',
  })

export const get: RequestHandler = async (request, response) => {
  const file = await service.get(context(request), fileId(request))
  response.json({
    success: true,
    data: {
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
    },
    message: 'File retrieved',
  })
}

function contentDisposition(mode: 'inline' | 'attachment', fileName: string) {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  return `${mode}; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
}

export const stream: RequestHandler = async (request, response, next) => {
  const mode = request.path.endsWith('/download') ? 'attachment' : 'inline'
  const result = await service.open(context(request), fileId(request))
  response.set({
    'Content-Type': result.file.mimeType,
    'Content-Length': String(result.size),
    'Content-Disposition': contentDisposition(
      mode,
      result.file.originalFileName,
    ),
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'private, no-store',
  })
  result.stream.on('error', next)
  request.on('aborted', () => result.stream.destroy())
  result.stream.pipe(response)
}

export const remove: RequestHandler = async (request, response) =>
  response.json({
    success: true,
    data: await service.remove(context(request), fileId(request)),
    message: 'File deleted',
  })

export const usage: RequestHandler = async (request, response) => {
  const storageContext = context(request)
  const bytes = await service.getTenantStorageUsage(storageContext.tenantId)
  response.json({
    success: true,
    data: { bytes },
    message: 'Storage usage retrieved',
  })
}
