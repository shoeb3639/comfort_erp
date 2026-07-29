import Joi from 'joi'

const optionalText = (maximum: number) =>
  Joi.string().trim().max(maximum).empty('').optional()

export const registerTenantSchema = Joi.object({
  tenant: Joi.object({
    code: Joi.string()
      .trim()
      .uppercase()
      .pattern(/^[A-Z0-9_-]+$/)
      .min(2)
      .max(50)
      .required(),
    legalName: Joi.string().trim().min(2).max(200).required(),
    tradeName: optionalText(200),
    businessType: optionalText(100),
    email: Joi.string().trim().lowercase().email().max(255).required(),
    mobile: Joi.string().trim().min(6).max(30).required(),
    alternateNumber: optionalText(30),
    website: Joi.string().trim().uri().max(255).empty('').optional(),
    logoUrl: Joi.string().trim().uri().empty('').optional(),
    addressLine1: optionalText(255),
    addressLine2: optionalText(255),
    city: optionalText(100),
    state: optionalText(100),
    pinCode: optionalText(20),
    country: Joi.string().trim().max(100).default('India'),
    gstin: optionalText(20),
    pan: optionalText(20),
    companyRegistrationNumber: optionalText(100),
    stateCode: optionalText(10),
    taxRegistrationType: optionalText(50),
    billingAddress: Joi.object().unknown(true).optional(),
    defaultCurrency: Joi.string().trim().uppercase().length(3).default('INR'),
    timeZone: Joi.string().trim().max(100).default('Asia/Kolkata'),
    financialYearStartMonth: Joi.number().integer().min(1).max(12).default(4),
    dateFormat: Joi.string().trim().max(30).default('DD/MM/YYYY'),
    invoicePrefix: optionalText(30),
    invoiceNumberLength: Joi.number().integer().min(1).max(12).default(6),
    taxSettings: Joi.object().unknown(true).optional(),
    status: Joi.string()
      .valid('PENDING_SETUP', 'ACTIVE')
      .default('PENDING_SETUP'),
  }).required(),
  owner: Joi.object({
    name: Joi.string().trim().min(2).max(150).required(),
    email: Joi.string().trim().lowercase().email().max(255).required(),
    mobile: optionalText(30),
    designation: optionalText(100),
    password: Joi.string().min(12).max(128).required(),
  }).required(),
  subscription: Joi.object({
    planId: Joi.string().uuid().required(),
    status: Joi.string().valid('TRIAL', 'ACTIVE').required(),
    billingCycle: Joi.string()
      .valid('MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'ANNUAL', 'CUSTOM')
      .optional(),
    startsAt: Joi.date().iso().required(),
    expiresAt: Joi.date().iso().greater(Joi.ref('startsAt')).required(),
    trialEndsAt: Joi.date()
      .iso()
      .min(Joi.ref('startsAt'))
      .max(Joi.ref('expiresAt'))
      .optional(),
    graceEndsAt: Joi.date().iso().greater(Joi.ref('expiresAt')).optional(),
    userLimit: Joi.number().integer().positive().optional(),
    vehicleLimit: Joi.number().integer().positive().optional(),
    bookingLimit: Joi.number().integer().positive().optional(),
    storageLimitMb: Joi.number().integer().positive().optional(),
    currency: Joi.string().trim().uppercase().length(3).default('INR'),
    amount: Joi.number().precision(2).min(0).optional(),
    discountAmount: Joi.number().precision(2).min(0).default(0),
    taxAmount: Joi.number().precision(2).min(0).default(0),
    finalAmount: Joi.number().precision(2).min(0).optional(),
    paymentStatus: Joi.string()
      .valid('PENDING', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'WAIVED')
      .default('PENDING'),
  }).required(),
})
