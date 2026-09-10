import type { StorageEntityType } from './storage.types'

export const DOCUMENT_TYPES: Record<StorageEntityType, readonly string[]> = {
  COMPANY: ['LOGO', 'REGISTRATION', 'OTHER'],
  CUSTOMER: ['ID_PROOF', 'ADDRESS_PROOF', 'OTHER'],
  VENDOR: ['AGREEMENT', 'ID_PROOF', 'OTHER'],
  VEHICLE: ['RC', 'INSURANCE', 'PERMIT', 'PUC', 'FITNESS', 'OTHER'],
  DRIVER: ['DRIVING_LICENSE', 'ID_PROOF', 'ADDRESS_PROOF', 'PHOTO', 'OTHER'],
  BOOKING: [
    'FUEL_RECEIPT',
    'OPENING_METER_PHOTO',
    'CLOSING_METER_PHOTO',
    'SIGNED_DUTY_SLIP',
    'TOLL_PARKING_RECEIPT',
    'OTHER',
  ],
  INVOICE: ['FINAL_PDF', 'SUPPORTING_DOCUMENT', 'OTHER'],
  RECEIPT: ['RECEIPT', 'PAYMENT_PROOF', 'OTHER'],
}

export const ENTITY_PERMISSION: Record<StorageEntityType, string> = {
  COMPANY: 'settings.company.manage',
  CUSTOMER: 'customer.view',
  VENDOR: 'vendor.view',
  VEHICLE: 'vehicle.view',
  DRIVER: 'driver.view',
  BOOKING: 'booking.view',
  INVOICE: 'invoice.view',
  RECEIPT: 'accounts.collection.view',
}

export const DANGEROUS_EXTENSIONS = new Set([
  'exe',
  'sh',
  'bat',
  'cmd',
  'php',
  'js',
  'mjs',
  'cjs',
  'jar',
  'com',
  'scr',
  'html',
  'htm',
])
