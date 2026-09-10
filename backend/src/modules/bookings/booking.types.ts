import type {
  AssignmentSource,
  BillingTripType,
  BookingStatus,
  BookingType,
  CollectionPaymentMode,
  CollectionStatus,
  PricingBasis,
  TripType,
} from '../../generated/prisma/enums'

export interface Context {
  tenantId: string
  userId: string
}

export interface BookingInput {
  customerId?: string
  travellerId?: string | null
  bookingType?: BookingType
  bookingPackage?: string | null
  tripType?: TripType
  serviceCity?: string
  startDate?: Date
  endDate?: Date
  pickupTime?: string
  travellingFrom?: string
  travellingTo?: string
  pickupReportingAddress?: string
  routeStops?: string | null
  packageDetails?: string | null
  requestedVehicleType?: string
  assignmentSource?: AssignmentSource
  pricingBasis?: PricingBasis
  customerRate?: number
  notes?: string | null
  requiredDutyDocuments?: RequiredDutyDocument[]
  status?: BookingStatus
}

export interface AssignmentInput {
  assignmentSource: AssignmentSource
  vendorId: string | null
  vehicleId: string
  driverId: string
  vendorRateType?: string | null
  vendorRate?: number | null
}

export interface DutyStartInput {
  openingOdometer?: number | null
  remarks?: string | null
}

export interface DutyCompleteInput {
  closingOdometer?: number | null
  tollTax: number
  parking: number
  driverAllowance: number
  otherRecoverableCharges: number
  remarks?: string | null
}

export type RequiredDutyDocument =
  'CLOSING_METER_PHOTO' | 'SIGNED_DUTY_SLIP' | 'TOLL_PARKING_RECEIPTS'

export type DutyEvidenceType =
  'opening-meter' | 'closing-meter' | 'duty-slip' | 'toll-parking'

export interface DutyEvidenceFile {
  originalName: string
  storageKey: string
  mimeType: string
  size: number
  uploadedAt: string
  uploadedByUserId: string
}

export type DutyEvidence = Partial<
  Record<
    'openingMeter' | 'closingMeter' | 'dutySlip' | 'tollParkingReceipts',
    DutyEvidenceFile
  >
>

export interface CloseBookingInput {
  billingTripType: BillingTripType
  startKm?: number | null
  endKm?: number | null
  ratePerKm?: number | null
  packageAmount?: number | null
  tollTax?: number
  parking?: number
  driverAllowance?: number
  otherRecoverableCharges?: number
  gst?: number
  dieselCost?: number
  fuelConsumedLitres?: number | null
  directVehicleExpense?: number
  driverCost?: number
  allocatedOfficeExpense?: number
  vendorPayableAmount?: number
  vendorExtraCharges?: number
  vendorDeduction?: number
  paymentAmount?: number
  paymentHolder?: 'COMPANY' | 'DRIVER'
  fuelAmount?: number
  fuelReceiptId?: string | null
  paymentMode?: CollectionPaymentMode
  paymentDate?: Date
  paymentReference?: string | null
  collectedBy?: string
  remarks?: string | null
  attachmentName?: string | null
}

export interface CollectionInput {
  collectionDate: Date
  amount: number
  paymentMode: CollectionPaymentMode
  collectedBy: string
  receiverName?: string | null
  referenceNumber?: string | null
  remarks?: string | null
  depositDate?: Date | null
  depositMode?: string | null
  depositReferenceNumber?: string | null
  depositedBy?: string | null
  verifiedBy?: string | null
  depositStatus?: CollectionStatus
}

export type CreateBookingInput = Required<
  Pick<
    BookingInput,
    | 'customerId'
    | 'bookingType'
    | 'serviceCity'
    | 'startDate'
    | 'endDate'
    | 'pickupTime'
    | 'travellingFrom'
    | 'travellingTo'
    | 'pickupReportingAddress'
    | 'requestedVehicleType'
    | 'assignmentSource'
    | 'pricingBasis'
    | 'customerRate'
  >
> &
  BookingInput
