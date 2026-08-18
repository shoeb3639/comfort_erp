import Joi from 'joi'
import { paginationQueryFields } from '../../shared/pagination'

export const vendorParamsSchema = Joi.object({
  vendorId: Joi.string().uuid().required(),
})
export const childParamsSchema = Joi.object({
  vendorId: Joi.string().uuid().required(),
  childId: Joi.string().uuid().required(),
})
export const vendorQuerySchema = Joi.object({
  ...paginationQueryFields,
  search: Joi.string().trim().max(200).empty(''),
  recordType: Joi.string().valid('external_vendor'),
  status: Joi.string().valid('ACTIVE', 'INACTIVE'),
})
export const vendorSchema = Joi.object({
  name: Joi.string().trim().min(2).max(200).required(),
  recordType: Joi.string().valid('external_vendor').default('external_vendor'),
  category: Joi.string().trim().min(2).max(100).required(),
  rating: Joi.number().min(0).max(5).precision(2).default(0),
  phone: Joi.string().trim().min(8).max(30).required(),
  city: Joi.string().trim().min(2).max(100).required(),
  status: Joi.string().valid('ACTIVE', 'INACTIVE').default('ACTIVE'),
})
export const updateVendorSchema = vendorSchema
  .fork(['name', 'category', 'phone', 'city'], (field) => field.optional())
  .min(1)

export const vehicleSchema = Joi.object({
  plate: Joi.string().trim().uppercase().min(4).max(30).required(),
  type: Joi.string().trim().min(2).max(100).required(),
  status: Joi.string()
    .valid('Ready', 'On Trip', 'Maintenance')
    .default('Ready'),
  make: Joi.string().trim().min(2).max(150).required(),
  seatingCapacity: Joi.number().integer().min(1).max(100).required(),
})
export const updateVehicleSchema = vehicleSchema
  .fork(['plate', 'type', 'make', 'seatingCapacity'], (field) =>
    field.optional(),
  )
  .min(1)

export const driverSchema = Joi.object({
  salutation: Joi.string().valid('MR', 'MS').allow(null),
  name: Joi.string().trim().min(2).max(150).required(),
  license: Joi.string().trim().uppercase().min(3).max(100).required(),
  status: Joi.string()
    .valid('Available', 'On Route', 'Offline')
    .default('Available'),
  phone: Joi.string().trim().min(8).max(30).required(),
  city: Joi.string().trim().min(2).max(100).required(),
})
export const updateDriverSchema = driverSchema
  .fork(['name', 'license', 'phone', 'city'], (field) => field.optional())
  .min(1)
