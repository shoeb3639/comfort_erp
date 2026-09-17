import Joi from 'joi'

export const citySearchQuerySchema = Joi.object({
  q: Joi.string().trim().max(100).empty(''),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(50).default(20),
})

export const placeSearchQuerySchema = Joi.object({
  q: Joi.string().trim().min(3).max(200).required(),
  latitude: Joi.number().min(-90).max(90),
  longitude: Joi.number().min(-180).max(180),
}).and('latitude', 'longitude')
