import Joi from 'joi'
import { paginationQueryFields } from '../../shared/pagination'

export const platformListQuerySchema = Joi.object({
  ...paginationQueryFields,
  tenantId: Joi.string().uuid(),
  search: Joi.string().trim().max(200).empty(''),
  status: Joi.string().valid(
    'PENDING_SETUP',
    'ACTIVE',
    'SUSPENDED',
    'EXPIRED',
    'CANCELLED',
  ),
})

export const planParamsSchema = Joi.object({
  planId: Joi.string().uuid().required(),
})
export const tenantParamsSchema = Joi.object({
  tenantId: Joi.string().uuid().required(),
})
export const subscriptionParamsSchema = Joi.object({
  subscriptionId: Joi.string().uuid().required(),
})

const planFields = {
  code: Joi.string()
    .trim()
    .uppercase()
    .pattern(/^[A-Z0-9_-]+$/)
    .min(2)
    .max(50),
  name: Joi.string().trim().min(2).max(150),
  description: Joi.string().trim().max(2000).empty('').allow(null),
  billingCycle: Joi.string().valid(
    'MONTHLY',
    'QUARTERLY',
    'HALF_YEARLY',
    'ANNUAL',
    'CUSTOM',
  ),
  basePrice: Joi.number().precision(2).min(0),
  validityDays: Joi.number().integer().positive().allow(null),
  userLimit: Joi.number().integer().positive().allow(null),
  vehicleLimit: Joi.number().integer().positive().allow(null),
  bookingLimit: Joi.number().integer().positive().allow(null),
  storageLimitMb: Joi.number().integer().positive().allow(null),
  trialDays: Joi.number().integer().min(0).max(365),
  isActive: Joi.boolean(),
}

export const createPlanSchema = Joi.object({
  ...planFields,
  code: planFields.code.required(),
  name: planFields.name.required(),
  billingCycle: planFields.billingCycle.required(),
  basePrice: planFields.basePrice.required(),
  trialDays: planFields.trialDays.default(0),
  isActive: planFields.isActive.default(true),
})

export const updatePlanSchema = Joi.object(planFields).min(1)

const subscriptionFields = {
  planId: Joi.string().uuid(),
  status: Joi.string().valid(
    'TRIAL',
    'ACTIVE',
    'GRACE_PERIOD',
    'EXPIRED',
    'SUSPENDED',
    'CANCELLED',
  ),
  billingCycle: Joi.string().valid(
    'MONTHLY',
    'QUARTERLY',
    'HALF_YEARLY',
    'ANNUAL',
    'CUSTOM',
  ),
  startsAt: Joi.date().iso(),
  expiresAt: Joi.date().iso(),
  trialEndsAt: Joi.date().iso().allow(null),
  graceEndsAt: Joi.date().iso().allow(null),
  userLimit: Joi.number().integer().positive().allow(null),
  vehicleLimit: Joi.number().integer().positive().allow(null),
  bookingLimit: Joi.number().integer().positive().allow(null),
  storageLimitMb: Joi.number().integer().positive().allow(null),
  currency: Joi.string().trim().uppercase().length(3),
  amount: Joi.number().precision(2).min(0),
  discountAmount: Joi.number().precision(2).min(0),
  taxAmount: Joi.number().precision(2).min(0),
  finalAmount: Joi.number().precision(2).min(0),
  paymentStatus: Joi.string().valid(
    'PENDING',
    'PARTIALLY_PAID',
    'PAID',
    'OVERDUE',
    'FAILED',
    'REFUNDED',
    'WAIVED',
  ),
}

export const createSubscriptionSchema = Joi.object({
  tenantId: Joi.string().uuid().required(),
  ...subscriptionFields,
  planId: subscriptionFields.planId.required(),
  status: subscriptionFields.status.required(),
  startsAt: subscriptionFields.startsAt.required(),
  expiresAt: subscriptionFields.expiresAt.required(),
  discountAmount: subscriptionFields.discountAmount.default(0),
  taxAmount: subscriptionFields.taxAmount.default(0),
  paymentStatus: subscriptionFields.paymentStatus.default('PENDING'),
})

export const updateSubscriptionSchema = Joi.object(subscriptionFields).min(1)

export const createOwnerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(150).required(),
  email: Joi.string().trim().lowercase().email().max(255).required(),
  mobile: Joi.string().trim().max(30).empty('').optional(),
  designation: Joi.string().trim().max(100).empty('').optional(),
  password: Joi.string().min(12).max(128).required(),
  status: Joi.string().valid('ACTIVE', 'PENDING_ACTIVATION').default('ACTIVE'),
})

const optionalText = (maximum: number) =>
  Joi.string().trim().max(maximum).empty('').allow(null)

export const updateTenantSchema = Joi.object({
  legalName: Joi.string().trim().min(2).max(200),
  tradeName: optionalText(200),
  email: Joi.string().trim().lowercase().email().max(255),
  mobile: Joi.string().trim().min(5).max(30),
  alternateNumber: optionalText(30),
  website: optionalText(255),
  logoUrl: Joi.string().trim().max(2000).empty('').allow(null),
  addressLine1: optionalText(255),
  addressLine2: optionalText(255),
  city: optionalText(100),
  state: optionalText(100),
  pinCode: optionalText(20),
  country: Joi.string().trim().min(2).max(100),
  gstin: optionalText(20),
  pan: optionalText(20),
  companyRegistrationNumber: optionalText(100),
  stateCode: optionalText(10),
  taxRegistrationType: optionalText(50),
  defaultCurrency: Joi.string().trim().uppercase().length(3),
  timeZone: Joi.string().trim().min(2).max(100),
  financialYearStartMonth: Joi.number().integer().min(1).max(12),
  dateFormat: Joi.string().trim().min(2).max(30),
  invoicePrefix: optionalText(30),
  invoiceNumberLength: Joi.number().integer().min(1).max(12),
}).min(1)

export const updateOwnerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(150),
  email: Joi.string().trim().lowercase().email().max(255),
  mobile: optionalText(30),
  designation: optionalText(100),
  status: Joi.string().valid(
    'PENDING_ACTIVATION',
    'ACTIVE',
    'INACTIVE',
    'SUSPENDED',
    'LOCKED',
  ),
}).min(1)

export const tenantStatusSchema = Joi.object({
  status: Joi.string().valid('ACTIVE', 'SUSPENDED').required(),
  reason: Joi.string().trim().min(3).max(1000).required(),
})
