import Joi from 'joi'

export const customerParamsSchema = Joi.object({
  customerId: Joi.string().uuid().required(),
})

export const travellerParamsSchema = Joi.object({
  customerId: Joi.string().uuid().required(),
  travellerId: Joi.string().uuid().required(),
})

export const customerListQuerySchema = Joi.object({
  search: Joi.string().trim().max(200).empty(''),
  type: Joi.string().valid('RETAIL', 'CORPORATE', 'TRAVEL_AGENT'),
  status: Joi.string().valid('ACTIVE', 'INACTIVE'),
})

const contactSchema = Joi.object({
  salutation: Joi.string().valid('MR', 'MS').allow(null),
  name: Joi.string().trim().min(2).max(150).required(),
  role: Joi.string().trim().max(100).empty('').allow(null),
  phone: Joi.string().trim().max(30).empty('').allow(null),
  email: Joi.string().trim().lowercase().email().max(255).empty('').allow(null),
  isPrimary: Joi.boolean().default(false),
})

export const createCustomerSchema = Joi.object({
  type: Joi.string().valid('RETAIL', 'CORPORATE', 'TRAVEL_AGENT').required(),
  salutation: Joi.string().valid('MR', 'MS').allow(null),
  name: Joi.string().trim().min(2).max(200).required(),
  billingName: Joi.string().trim().min(2).max(200).required(),
  email: Joi.string().trim().lowercase().email().max(255).required(),
  phone: Joi.string().trim().min(8).max(30).required(),
  city: Joi.string().trim().min(2).max(100).required(),
  gstin: Joi.string().trim().uppercase().max(20).empty('').allow(null),
  billingAddress: Joi.string().trim().min(3).max(2000).required(),
  creditLimit: Joi.number().min(0).precision(2).default(0),
  status: Joi.string().valid('ACTIVE', 'INACTIVE').default('ACTIVE'),
  contacts: Joi.array().items(contactSchema).max(20),
})

export const updateCustomerSchema = createCustomerSchema
  .fork(
    ['type', 'name', 'billingName', 'email', 'phone', 'city', 'billingAddress'],
    (field) => field.optional(),
  )
  .min(1)

export const createTravellerSchema = Joi.object({
  travellerType: Joi.string().trim().max(50).required(),
  salutation: Joi.string().valid('MR', 'MS').allow(null),
  name: Joi.string().trim().min(2).max(150).required(),
  phone: Joi.string().trim().max(30).empty('').allow(null),
  email: Joi.string().trim().lowercase().email().max(255).empty('').allow(null),
  department: Joi.string().trim().max(100).empty('').allow(null),
  employeeId: Joi.string().trim().max(100).empty('').allow(null),
  notes: Joi.string().trim().max(2000).empty('').allow(null),
  status: Joi.string().valid('ACTIVE', 'INACTIVE').default('ACTIVE'),
})

export const updateTravellerSchema = createTravellerSchema
  .fork(['travellerType', 'name'], (field) => field.optional())
  .min(1)
