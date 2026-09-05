import Joi from 'joi'

const optionalText = (max: number) =>
  Joi.string().trim().max(max).empty('').allow(null)

const invoicePrefix = Joi.string()
  .trim()
  .uppercase()
  .pattern(/^[A-Z]{1,3}$/)
  .empty('')
  .allow(null)
  .messages({
    'string.pattern.base':
      'Invoice prefix must contain 1 to 3 uppercase letters.',
  })

export const recordParamsSchema = Joi.object({
  recordId: Joi.string().uuid().required(),
})

export const companyProfileSchema = Joi.object({
  legalName: Joi.string().trim().min(2).max(200),
  tradeName: optionalText(200),
  email: Joi.string().trim().lowercase().email().max(255),
  mobile: Joi.string().trim().min(6).max(30),
  alternateNumber: optionalText(30),
  website: Joi.string().trim().uri().max(255).empty('').allow(null),
  logoUrl: Joi.string().trim().uri().empty('').allow(null),
  addressLine1: optionalText(255),
  addressLine2: optionalText(255),
  city: optionalText(100),
  state: optionalText(100),
  pinCode: optionalText(20),
  country: Joi.string().trim().max(100),
  billingAddress: Joi.object().unknown(true).allow(null),
  defaultCurrency: Joi.string().trim().uppercase().length(3),
  timeZone: Joi.string().trim().max(100),
  financialYearStartMonth: Joi.number().integer().min(1).max(12),
  dateFormat: Joi.string().trim().max(30),
  bookingPrefix: Joi.string()
    .trim()
    .uppercase()
    .pattern(/^[A-Z0-9]{4}$/)
    .allow(null),
  invoicePrefix,
  smsPrefix: Joi.string()
    .trim()
    .uppercase()
    .pattern(/^[A-Z0-9]{2,12}$/)
    .empty('')
    .allow(null),
}).min(1)

export const taxSettingsSchema = Joi.object({
  gstin: optionalText(20),
  pan: optionalText(20),
  companyRegistrationNumber: optionalText(100),
  stateCode: optionalText(10),
  taxRegistrationType: optionalText(50),
  taxSettings: Joi.object().unknown(true).required(),
})

export const invoiceSettingsSchema = Joi.object({
  invoicePrefix,
  invoiceNumberLength: Joi.number().integer().min(1).max(12),
  invoiceSettings: Joi.object().unknown(true).required(),
})

const status = Joi.string().valid('ACTIVE', 'INACTIVE')

export const locationSchema = Joi.object({
  name: Joi.string().trim().min(2).max(150).required(),
  code: optionalText(50),
  addressLine1: optionalText(255),
  addressLine2: optionalText(255),
  city: optionalText(100),
  state: optionalText(100),
  pinCode: optionalText(20),
  country: Joi.string().trim().max(100).default('India'),
  phone: optionalText(30),
  email: Joi.string().trim().lowercase().email().max(255).empty('').allow(null),
  isPrimary: Joi.boolean().default(false),
  status: status.default('ACTIVE'),
})

export const updateLocationSchema = locationSchema
  .fork(['name'], (field) => field.optional())
  .min(1)

export const bankAccountSchema = Joi.object({
  accountName: Joi.string().trim().min(2).max(150).required(),
  bankName: Joi.string().trim().min(2).max(150).required(),
  branchName: optionalText(150),
  accountNumber: Joi.string().trim().min(4).max(100).required(),
  ifscCode: Joi.string().trim().uppercase().min(4).max(20).required(),
  accountType: optionalText(50),
  upiId: optionalText(150),
  isDefault: Joi.boolean().default(false),
  status: status.default('ACTIVE'),
})

export const updateBankAccountSchema = bankAccountSchema
  .fork(['accountName', 'bankName', 'accountNumber', 'ifscCode'], (field) =>
    field.optional(),
  )
  .min(1)

export const gstRegistrationSchema = Joi.object({
  registrationName: Joi.string().trim().min(2).max(150).required(),
  legalName: Joi.string().trim().min(2).max(200).required(),
  tradeName: optionalText(200),
  registrationType: Joi.string()
    .valid('Regular', 'Composition', 'Unregistered', 'Other')
    .required(),
  gstin: optionalText(20),
  pan: optionalText(20),
  registeredAddress: Joi.string().trim().max(2000).empty('').allow(null),
  addressLine1: optionalText(255),
  addressLine2: optionalText(255),
  city: optionalText(100),
  district: optionalText(100),
  state: Joi.string().trim().min(2).max(100).required(),
  stateCode: Joi.string().trim().min(1).max(10).required(),
  pinCode: optionalText(20),
  country: Joi.string().trim().max(100).default('India'),
  effectiveFrom: Joi.date().iso().allow(null),
  effectiveTo: Joi.date().iso().allow(null),
  isDefault: Joi.boolean().default(false),
  status: status.default('ACTIVE'),
  notes: Joi.string().trim().max(2000).empty('').allow(null),
  locationIds: Joi.array().items(Joi.string().uuid()).unique().default([]),
})

export const updateGstRegistrationSchema = gstRegistrationSchema
  .fork(
    ['registrationName', 'legalName', 'registrationType', 'state', 'stateCode'],
    (field) => field.optional(),
  )
  .min(1)

export const createTenantUserSchema = Joi.object({
  name: Joi.string().trim().min(2).max(150).required(),
  email: Joi.string().trim().lowercase().email().max(255).required(),
  mobile: optionalText(30),
  designation: optionalText(100),
  password: Joi.string().min(12).max(128).required(),
  roleId: Joi.string().uuid().required(),
  locationIds: Joi.array().items(Joi.string().uuid()).unique().default([]),
  status: Joi.string()
    .valid('ACTIVE', 'PENDING_ACTIVATION', 'INACTIVE', 'SUSPENDED')
    .default('ACTIVE'),
})

export const updateTenantUserSchema = Joi.object({
  name: Joi.string().trim().min(2).max(150),
  email: Joi.string().trim().lowercase().email().max(255),
  mobile: optionalText(30),
  designation: optionalText(100),
  password: Joi.string().min(12).max(128),
  roleId: Joi.string().uuid(),
  locationIds: Joi.array().items(Joi.string().uuid()).unique(),
  status: Joi.string().valid(
    'ACTIVE',
    'PENDING_ACTIVATION',
    'INACTIVE',
    'SUSPENDED',
    'LOCKED',
  ),
}).min(1)

export const createRoleSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  code: Joi.string()
    .trim()
    .uppercase()
    .pattern(/^[A-Z0-9_]+$/)
    .min(2)
    .max(100)
    .required(),
  description: Joi.string().trim().max(2000).empty('').allow(null),
  permissionIds: Joi.array().items(Joi.string().uuid()).unique().default([]),
  status: Joi.string().valid('ACTIVE', 'INACTIVE').default('ACTIVE'),
})

export const updateRoleSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100),
  description: Joi.string().trim().max(2000).empty('').allow(null),
  status: Joi.string().valid('ACTIVE', 'INACTIVE'),
}).min(1)

export const rolePermissionsSchema = Joi.object({
  permissionIds: Joi.array().items(Joi.string().uuid()).unique().required(),
})
