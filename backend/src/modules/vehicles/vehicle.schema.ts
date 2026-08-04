import Joi from 'joi'
import { paginationQueryFields } from '../../shared/pagination'

export const vehicleParamsSchema = Joi.object({
  vehicleId: Joi.string().uuid().required(),
})
export const vehicleTypeSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
})

export const vehicleQuerySchema = Joi.object({
  ...paginationQueryFields,
  search: Joi.string().trim().max(200).empty(''),
  ownershipType: Joi.string().valid('OWN', 'VENDOR'),
  vendorId: Joi.string().uuid(),
  vehicleTypeId: Joi.string().uuid(),
  status: Joi.string().valid('ACTIVE', 'INACTIVE'),
})

export const vehicleSchema = Joi.object({
  ownershipType: Joi.string().valid('OWN', 'VENDOR').required(),
  vendorId: Joi.string().uuid().allow(null),
  registrationNumber: Joi.string().trim().uppercase().min(4).max(30).required(),
  vehicleTypeId: Joi.string().uuid().required(),
  make: Joi.string().trim().max(150).allow('', null),
  model: Joi.string().trim().max(150).allow('', null),
  variant: Joi.string().trim().max(150).allow('', null),
  fuelType: Joi.string().trim().max(50).allow('', null),
  manufacturingYear: Joi.number().integer().min(1900).max(2100).allow(null),
  registrationDate: Joi.date().iso().allow(null),
  insuranceExpiry: Joi.date().iso().allow(null),
  permitExpiry: Joi.date().iso().allow(null),
  fitnessExpiry: Joi.date().iso().allow(null),
  seatingCapacity: Joi.number().integer().min(1).max(100).allow(null),
  status: Joi.string().valid('ACTIVE', 'INACTIVE').default('ACTIVE'),
})

export const updateVehicleSchema = vehicleSchema
  .fork(['ownershipType', 'registrationNumber', 'vehicleTypeId'], (field) =>
    field.optional(),
  )
  .min(1)

export const vendorVehicleSchema = vehicleSchema
  .fork(['ownershipType', 'vendorId', 'vehicleTypeId'], (field) =>
    field.optional(),
  )
  .keys({ vehicleType: Joi.string().trim().min(2).max(100) })
  .or('vehicleTypeId', 'vehicleType')
