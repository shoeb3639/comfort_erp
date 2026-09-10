import Joi from 'joi'
import { paginationQueryFields } from '../../shared/pagination'

const optionalText = (max: number) =>
  Joi.string().trim().max(max).empty('').allow(null)

const requiredDutyDocuments = Joi.array()
  .items(
    Joi.string().valid(
      'CLOSING_METER_PHOTO',
      'SIGNED_DUTY_SLIP',
      'TOLL_PARKING_RECEIPTS',
    ),
  )
  .unique()
  .max(3)

const fields = {
  customerId: Joi.string().uuid(),
  travellerId: Joi.string().uuid().allow(null),
  bookingType: Joi.string().valid(
    'PACKAGE',
    'LOCAL',
    'AIRPORT_TRANSFER',
    'RAILWAY_STATION_TRANSFER',
    'OUTSTATION',
  ),
  bookingPackage: optionalText(100),
  tripType: Joi.string().valid('ONE_WAY', 'ROUNDTRIP', 'MULTI_CITY'),
  serviceCity: Joi.string().trim().min(2).max(100),
  startDate: Joi.date().iso(),
  endDate: Joi.date().iso(),
  pickupTime: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/),
  travellingFrom: optionalText(500),
  travellingTo: optionalText(500),
  pickupReportingAddress: Joi.string().trim().min(3).max(500),
  routeStops: optionalText(5000),
  packageDetails: optionalText(5000),
  requestedVehicleType: Joi.string().trim().min(2).max(150),
  assignmentSource: Joi.string().valid('OWN', 'VENDOR'),
  pricingBasis: Joi.string().valid('FIXED', 'RATE_PER_KM'),
  customerRate: Joi.number().precision(2).min(0),
  notes: optionalText(5000),
  requiredDutyDocuments,
  status: Joi.string().valid('DRAFT', 'CONFIRMED'),
}

export const createBookingSchema = Joi.object({
  ...fields,
  customerId: fields.customerId.required(),
  bookingType: fields.bookingType.required(),
  serviceCity: fields.serviceCity.required(),
  startDate: fields.startDate.required(),
  endDate: fields.endDate.required(),
  pickupTime: fields.pickupTime.required(),
  travellingFrom: fields.travellingFrom.required(),
  travellingTo: fields.travellingTo.required(),
  pickupReportingAddress: fields.pickupReportingAddress.required(),
  requestedVehicleType: fields.requestedVehicleType.required(),
  assignmentSource: fields.assignmentSource.required(),
  pricingBasis: fields.pricingBasis.required(),
  customerRate: fields.customerRate.required(),
}).min(1)

export const updateBookingSchema = Joi.object({
  ...fields,
  status: Joi.forbidden(),
}).min(1)

export const assignmentSchema = Joi.object({
  assignmentSource: Joi.string().valid('OWN', 'VENDOR').required(),
  vendorId: Joi.string().uuid().allow(null).required(),
  vehicleId: Joi.string().uuid().required(),
  driverId: Joi.string().uuid().required(),
  vendorRateType: optionalText(50),
  vendorRate: Joi.number().precision(2).min(0).allow(null),
})

export const dutyStartSchema = Joi.object({
  openingOdometer: Joi.number().precision(2).min(0).allow(null),
  remarks: optionalText(2000),
})

const money = Joi.number().precision(2).min(0)

export const dutyCompleteSchema = Joi.object({
  closingOdometer: Joi.number().precision(2).min(0).allow(null),
  tollTax: money.default(0),
  parking: money.default(0),
  driverAllowance: money.default(0),
  otherRecoverableCharges: money.default(0),
  paymentAmount: Joi.forbidden(),
  paymentMode: Joi.forbidden(),
  paymentDate: Joi.forbidden(),
  paymentReference: Joi.forbidden(),
  collectedBy: Joi.forbidden(),
  remarks: optionalText(2000),
})

export const cancellationSchema = Joi.object({
  reason: Joi.string().trim().min(3).max(2000).required(),
})

export const closeBookingSchema = Joi.object({
  billingTripType: Joi.string().valid('KM_BASED', 'PACKAGE_BASED').required(),
  startKm: money.allow(null),
  endKm: money.allow(null),
  ratePerKm: money.allow(null),
  packageAmount: money.allow(null),
  tollTax: money.default(0),
  parking: money.default(0),
  driverAllowance: money.default(0),
  otherRecoverableCharges: money.default(0),
  gst: money.default(0),
  dieselCost: money.default(0),
  fuelConsumedLitres: money.allow(null),
  directVehicleExpense: money.default(0),
  driverCost: money.default(0),
  allocatedOfficeExpense: money.default(0),
  vendorPayableAmount: money.default(0),
  vendorExtraCharges: money.default(0),
  vendorDeduction: money.default(0),
  paymentAmount: money.default(0),
  paymentHolder: Joi.string().valid('COMPANY', 'DRIVER').default('COMPANY'),
  fuelAmount: money.default(0),
  fuelReceiptId: Joi.string().uuid().allow(null),
  paymentMode: Joi.string()
    .valid('CASH', 'UPI', 'BANK_TRANSFER', 'CARD', 'CHEQUE')
    .when('paymentAmount', {
      is: Joi.number().greater(0),
      then: Joi.required(),
    }),
  paymentDate: Joi.date()
    .iso()
    .when('paymentAmount', {
      is: Joi.number().greater(0),
      then: Joi.required(),
    }),
  paymentReference: Joi.string()
    .trim()
    .min(3)
    .max(150)
    .pattern(/^[A-Za-z0-9][A-Za-z0-9 /_.:-]*$/)
    .allow('', null),
  collectedBy: Joi.string()
    .trim()
    .min(2)
    .max(150)
    .when('paymentAmount', {
      is: Joi.number().greater(0),
      then: Joi.required(),
    }),
  remarks: optionalText(5000),
  attachmentName: optionalText(255),
})

export const collectionSchema = Joi.object({
  collectionDate: Joi.date().iso().required(),
  amount: Joi.number().precision(2).greater(0).required(),
  paymentMode: Joi.string()
    .valid('CASH', 'UPI', 'BANK_TRANSFER', 'CARD', 'CHEQUE')
    .required(),
  collectedBy: Joi.string().trim().min(2).max(150).required(),
  receiverName: optionalText(150),
  referenceNumber: Joi.string()
    .trim()
    .min(3)
    .max(150)
    .pattern(/^[A-Za-z0-9][A-Za-z0-9 /_.:-]*$/)
    .allow('', null),
  remarks: optionalText(2000),
  depositDate: Joi.date().iso().allow(null),
  depositMode: optionalText(50),
  depositReferenceNumber: Joi.string()
    .trim()
    .min(3)
    .max(150)
    .pattern(/^[A-Za-z0-9][A-Za-z0-9 /_.:-]*$/)
    .allow('', null),
  depositedBy: optionalText(150),
  verifiedBy: optionalText(150),
  depositStatus: Joi.string().valid(
    'PENDING',
    'WITH_MANAGER',
    'DEPOSITED',
    'VERIFIED',
    'DIRECTLY_RECEIVED',
  ),
})

export const collectionVerificationSchema = Joi.object({
  verifiedBy: optionalText(150),
})

export const bookingParamsSchema = Joi.object({
  bookingId: Joi.string()
    .trim()
    .max(36)
    .pattern(
      /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|\d{2}-\d{7,}|[A-Z0-9]{4}-\d{6}|CMF\d{2}-(?:\d{5,6}|\d{4}-\d{3}))$/i,
    )
    .required(),
})

export const bookingCollectionParamsSchema = bookingParamsSchema.keys({
  collectionId: Joi.string().uuid().required(),
})

export const bookingQuerySchema = Joi.object({
  ...paginationQueryFields,
  search: Joi.string().trim().max(200),
  status: Joi.string().valid(
    'DRAFT',
    'CONFIRMED',
    'ASSIGNED',
    'RUNNING',
    'COMPLETED',
    'CLOSED',
    'CANCELLED',
  ),
  view: Joi.string().valid('ACTIVE', 'CLOSED'),
})
