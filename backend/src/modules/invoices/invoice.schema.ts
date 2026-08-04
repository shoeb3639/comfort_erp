import Joi from 'joi'
import { paginationQueryFields } from '../../shared/pagination'

export const invoiceParamsSchema = Joi.object({
  invoiceId: Joi.string().uuid().required(),
})

export const invoiceQuerySchema = Joi.object({
  ...paginationQueryFields,
  search: Joi.string().trim().max(200).empty(''),
  status: Joi.string().valid('DRAFT', 'GENERATED', 'CANCELLED'),
  source: Joi.string().valid('BOOKING', 'DIRECT'),
})

const itemSchema = Joi.object({
  dateType: Joi.string().valid('single', 'range', 'blank').default('single'),
  serviceDate: Joi.date().iso().allow('', null),
  serviceStartDate: Joi.date().iso().allow('', null),
  serviceEndDate: Joi.date()
    .iso()
    .min(Joi.ref('serviceStartDate'))
    .allow('', null),
  description: Joi.string().trim().min(1).max(500).required(),
  quantity: Joi.number().precision(2).greater(0).required(),
  unit: Joi.string()
    .valid(
      'KM',
      'Day',
      'Days',
      'Hour',
      'Hours',
      'Package',
      'Trip',
      'Night',
      'Actual',
      'Discount',
    )
    .required(),
  rate: Joi.number().precision(2).required(),
  amount: Joi.number().precision(2),
})

export const invoiceBodySchema = Joi.object({
  bookingId: Joi.string().uuid().allow(null),
  customerId: Joi.string().uuid().required(),
  invoiceDate: Joi.date().iso().required(),
  gstType: Joi.string().valid('NO_GST', 'CGST_SGST', 'IGST').required(),
  billingName: Joi.string().trim().min(1).max(200).required(),
  billingAddress: Joi.string().trim().min(1).max(2000).required(),
  customerGstin: Joi.string().trim().uppercase().max(20).allow('', null),
  referenceNumber: Joi.string().trim().max(150).allow('', null),
  billingType: Joi.string().trim().max(50).allow('', null),
  billingContact: Joi.string().trim().max(200).allow('', null),
  billingMobile: Joi.string().trim().max(30).allow('', null),
  billingEmail: Joi.string().trim().email().max(255).allow('', null),
  vehicleDescription: Joi.string().trim().max(255).allow('', null),
  serviceCity: Joi.string().trim().max(150).allow('', null),
  placeOfSupply: Joi.string().trim().max(150).allow('', null),
  hsnCode: Joi.string().trim().max(30).allow('', null),
  paymentTerms: Joi.string().trim().max(255).allow('', null),
  terms: Joi.string().trim().max(5000).allow('', null),
  displaySnapshot: Joi.object().unknown(true).allow(null),
  items: Joi.array().items(itemSchema).min(1).max(100).required(),
})

export const cancelInvoiceSchema = Joi.object({
  reason: Joi.string().trim().min(3).max(2000).required(),
})
