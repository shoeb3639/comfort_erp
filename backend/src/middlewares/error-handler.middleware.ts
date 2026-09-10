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
  const databaseUnavailable =
    typeof error === 'object' &&
    error !== null &&
    ('code' in error
      ? ['P1000', 'P1001', 'P1002', 'P1008', 'P1017'].includes(
          String(error.code),
        )
      : false)
  const appError =
    error instanceof AppError
      ? error
      : typeof error === 'object' &&
          error !== null &&
          'code' in error &&
          error.code === 'LIMIT_FILE_SIZE'
        ? new AppError(
            'Uploaded file exceeds the configured size limit',
            'FILE_TOO_LARGE',
            413,
          )
        : typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            String(error.code).startsWith('LIMIT_')
          ? new AppError('Invalid multipart upload', 'INVALID_FILE_UPLOAD', 400)
          : typeof error === 'object' &&
              error !== null &&
              'type' in error &&
              error.type === 'entity.too.large'
            ? new AppError(
                'Uploaded file exceeds the 10 MB limit',
                'FILE_TOO_LARGE',
                413,
              )
            : databaseUnavailable
              ? new AppError(
                  'Database service is unavailable. Please try again shortly.',
                  'SERVICE_UNAVAILABLE',
                  503,
                )
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
