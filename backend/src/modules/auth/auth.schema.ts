import Joi from 'joi'

export const loginSchema = Joi.object({
  email: Joi.string().email().max(255).required(),
  password: Joi.string().min(8).max(128).required(),
})

export const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().min(32).required(),
})
