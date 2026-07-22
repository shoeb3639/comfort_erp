import type { ErrorRequestHandler, RequestHandler } from 'express'
import { logger } from '../config/logger'
import { AppError } from '../shared/errors/app-error'

export const notFoundHandler: RequestHandler = (request, _response, next) => {
  next(
    new AppError(
      `Route ${request.method} ${request.originalUrl} was not found`,
      'NOT_FOUND',
      404,
    ),
  )
}

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  request,
  response,
  _next,
) => {
  const appError =
    error instanceof AppError
      ? error
      : new AppError(
          'An unexpected error occurred',
          'INTERNAL_SERVER_ERROR',
          500,
        )

  logger.error(appError.message, {
    code: appError.code,
    method: request.method,
    path: request.originalUrl,
    stack: error instanceof Error ? error.stack : undefined,
  })

  response.status(appError.statusCode).json({
    success: false,
    message: appError.message,
    code: appError.code,
    details: appError.details,
  })
}
