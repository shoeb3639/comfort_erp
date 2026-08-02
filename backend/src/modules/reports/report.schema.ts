import Joi from 'joi'

export const reportKeys = [
  'business-summary',
  'booking-register',
  'invoice-register',
  'outstanding-invoices',
  'expense-register',
  'vehicle-utilization',
  'vendor-duty',
] as const

export type ReportKey = (typeof reportKeys)[number]

export const reportParamsSchema = Joi.object({
  reportKey: Joi.string()
    .valid(...reportKeys)
    .required(),
})

export const reportQuerySchema = Joi.object({
  dateFrom: Joi.date().iso(),
  dateTo: Joi.date().iso().min(Joi.ref('dateFrom')),
  status: Joi.string().trim().uppercase().max(50),
  customerId: Joi.string().uuid(),
  vendorId: Joi.string().uuid(),
  vehicleId: Joi.string().uuid(),
  assignmentSource: Joi.string().valid('OWN', 'VENDOR'),
  search: Joi.string().trim().max(200),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(500).default(100),
})
