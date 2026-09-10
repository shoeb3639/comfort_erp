import type { Readable } from 'node:stream'

export const STORAGE_ENTITY_TYPES = [
  'COMPANY',
  'CUSTOMER',
  'VENDOR',
  'VEHICLE',
  'DRIVER',
  'BOOKING',
  'INVOICE',
  'RECEIPT',
] as const

export type StorageEntityType = (typeof STORAGE_ENTITY_TYPES)[number]

export interface UploadFileInput {
  storageKey: string
  contents: Buffer
}

export interface StoredFileResult {
  storageKey: string
  size: number
}

export interface FileReadResult {
  stream: Readable
  size: number
}

export interface StorageContext {
  tenantId: string
  userId: string
  permissions: string[]
}

export interface UploadRequest {
  entityType: StorageEntityType
  entityId: string
  documentType?: string | null
  originalFileName: string
  mimeType: string
  contents: Buffer
}
