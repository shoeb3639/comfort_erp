import type {
  SetupRecordStatus,
  VehicleOwnershipType,
} from '../../generated/prisma/client'

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
