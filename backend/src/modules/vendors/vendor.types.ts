import type { Salutation } from '../../generated/prisma/enums'

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
