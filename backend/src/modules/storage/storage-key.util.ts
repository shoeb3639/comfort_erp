import { posix } from 'node:path'
import type { StorageEntityType } from './storage.types'

const entityFolders: Record<StorageEntityType, string> = {
  COMPANY: 'company',
  CUSTOMER: 'customers',
  VENDOR: 'vendors',
  VEHICLE: 'vehicles',
  DRIVER: 'drivers',
  BOOKING: 'bookings',
  INVOICE: 'invoices',
  RECEIPT: 'receipts',
}

export function buildStorageKey(input: {
  tenantId: string
  entityType: StorageEntityType
  entityId: string
  storedFileName: string
  financialYear?: string | null
}) {
  const segments = ['tenants', input.tenantId, entityFolders[input.entityType]]
  if (input.entityType === 'INVOICE' && input.financialYear)
    segments.push(input.financialYear)
  if (input.entityType !== 'COMPANY') segments.push(input.entityId)
  segments.push(input.storedFileName)
  return posix.join(...segments)
}
