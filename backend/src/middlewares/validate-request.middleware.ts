import type { RequestHandler } from 'express'
import type Joi from 'joi'
import { AppError } from '../shared/errors/app-error'
import { normalizeValidatedInput } from '../shared/text/normalize-input'

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

    const validatedBody: unknown = normalizeValidatedInput(result.value)
    request.body = validatedBody
    next()
  }
}

export function validateParams(schema: Joi.ObjectSchema): RequestHandler {
  return (request, _response, next) => {
    const result = schema.validate(request.params, {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true,
    })
    if (result.error) {
      next(
        new AppError(
          'Validation failed',
          'VALIDATION_ERROR',
          400,
          result.error.details.map((detail) => ({
            field: detail.path.join('.'),
            message: detail.message,
          })),
        ),
      )
      return
    }
    request.params = normalizeValidatedInput(
      result.value,
    ) as typeof request.params
    next()
  }
}

export function validateQuery(schema: Joi.ObjectSchema): RequestHandler {
  return (request, _response, next) => {
    const result = schema.validate(request.query, {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true,
    })
    if (result.error) {
      next(
        new AppError(
          'Validation failed',
          'VALIDATION_ERROR',
          400,
          result.error.details.map((detail) => ({
            field: detail.path.join('.'),
            message: detail.message,
          })),
        ),
      )
      return
    }
    Object.assign(request.query, normalizeValidatedInput(result.value))
    next()
  }
}
