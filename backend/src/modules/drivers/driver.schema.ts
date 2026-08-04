import Joi from 'joi'
import { paginationQueryFields } from '../../shared/pagination'
export const driverParamsSchema = Joi.object({
  driverId: Joi.string().uuid().required(),
})
export const driverQuerySchema = Joi.object({
  ...paginationQueryFields,
  search: Joi.string().trim().max(200).empty(''),
  engagementType: Joi.string().valid('OWN', 'VENDOR'),
  vendorId: Joi.string().uuid(),
  status: Joi.string().valid('ACTIVE', 'INACTIVE'),
})
export const driverSchema = Joi.object({
  engagementType: Joi.string().valid('OWN', 'VENDOR').required(),
  vendorId: Joi.string().uuid().allow(null),
  salutation: Joi.string().valid('MR', 'MS').allow(null),
  name: Joi.string().trim().min(2).max(150).required(),
  mobile: Joi.string().trim().min(8).max(30).required(),
  alternateMobile: Joi.string().trim().min(8).max(30).allow('', null),
  licenceNumber: Joi.string()
    .trim()
    .uppercase()
    .min(3)
    .max(100)
    .allow('', null),
  licenceType: Joi.string().trim().max(100).allow('', null),
  licenceExpiry: Joi.date().iso().allow(null),
  address: Joi.string().trim().max(1000).allow('', null),
  identityDetails: Joi.object().allow(null),
  status: Joi.string().valid('ACTIVE', 'INACTIVE').default('ACTIVE'),
})
export const updateDriverSchema = driverSchema
  .fork(['engagementType', 'name', 'mobile'], (field) => field.optional())
  .min(1)
export const vendorDriverSchema = driverSchema.fork(
  ['engagementType', 'vendorId'],
  (field) => field.optional(),
)
