import Joi from 'joi'

const optionalText = (max: number) =>
  Joi.string().trim().max(max).empty('').allow(null)

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
  vendorPayableAmount: Joi.number().precision(2).min(0).allow(null),
  vendorNotes: optionalText(5000),
})

export const dutyStartSchema = Joi.object({
  openingOdometer: Joi.number().precision(2).min(0).allow(null),
  remarks: optionalText(2000),
})

export const dutyCompleteSchema = Joi.object({
  closingOdometer: Joi.number().precision(2).min(0).allow(null),
  remarks: optionalText(2000),
})

export const cancellationSchema = Joi.object({
  reason: Joi.string().trim().min(3).max(2000).required(),
})

const money = Joi.number().precision(2).min(0)

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
  directVehicleExpense: money.default(0),
  driverCost: money.default(0),
  allocatedOfficeExpense: money.default(0),
  vendorPayableAmount: money.default(0),
  vendorExtraCharges: money.default(0),
  vendorDeduction: money.default(0),
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
  referenceNumber: optionalText(150),
  remarks: optionalText(2000),
  depositDate: Joi.date().iso().allow(null),
  depositMode: optionalText(50),
  depositReferenceNumber: optionalText(150),
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
    .pattern(/^(?:[0-9a-f-]{36}|[A-Z0-9]{4}-\d{6})$/i)
    .required(),
})

export const bookingCollectionParamsSchema = bookingParamsSchema.keys({
  collectionId: Joi.string().uuid().required(),
})

export const bookingQuerySchema = Joi.object({
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

export const bookingPrefixSchema = Joi.object({
  bookingPrefix: Joi.string()
    .trim()
    .uppercase()
    .pattern(/^[A-Z0-9]{4}$/)
    .required(),
})
