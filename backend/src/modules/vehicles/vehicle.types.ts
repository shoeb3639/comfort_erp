import type {
  SetupRecordStatus,
  VehicleOwnershipType,
} from '../../generated/prisma/client'
import type { PageRequest } from '../../shared/pagination'

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

export type VehicleLedgerGroupBy = 'DAY' | 'MONTH'

export interface VehicleLedgerFilters extends PageRequest {
  dateFrom?: Date
  dateTo?: Date
  groupBy: VehicleLedgerGroupBy
  profitDataStatus?:
    'NOT_TRACKED' | 'AVAILABLE' | 'INCOMPLETE' | 'REGISTER_ONLY'
}

export interface VehicleLedgerEntry {
  id: string
  entryType: 'BOOKING' | 'EXPENSE'
  date: string
  bookingId: string | null
  bookingNumber: string | null
  customer: string | null
  driver: string | null
  route: string | null
  status: string
  description: string
  category: string | null
  referenceNumber: string | null
  openingKm: number | null
  closingKm: number | null
  runningKm: number
  billedAmount: number
  recoverableCharges: number
  revenue: number
  bookingCost: number
  expenseAmount: number
  linkedExpenseForReview: number
  netProfit: number | null
  commissionProfit: number
  profitDataStatus: string | null
  includedInProfit: boolean
  profitTreatment: string
}

export interface VehicleLedgerTotals {
  bookings: number
  closedBookings: number
  expenseEntries: number
  runningKm: number
  billedAmount: number
  recoverableCharges: number
  revenue: number
  bookingCosts: number
  additionalVehicleExpenses: number
  linkedExpensesForReview: number
  netProfit: number
  commissionProfit: number
}

export interface VehicleLedgerPeriod extends VehicleLedgerTotals {
  period: string
}
