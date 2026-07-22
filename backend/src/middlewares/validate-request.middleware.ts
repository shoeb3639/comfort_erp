import type { RequestHandler } from 'express'
import type Joi from 'joi'
import { AppError } from '../shared/errors/app-error'

export function validateBody(schema: Joi.ObjectSchema): RequestHandler {
  return (request, _response, next) => {
    const result = schema.validate(request.body, {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true,
    })

    if (result.error) {
      next(
        new AppError('Validation failed', 'VALIDATION_ERROR', 400, [
          ...result.error.details.map((detail) => ({
            field: detail.path.join('.'),
            message: detail.message,
          })),
        ]),
      )
      return
    }

    const validatedBody: unknown = result.value
    request.body = validatedBody
    next()
  }
}
