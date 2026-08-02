import type { RequestHandler } from 'express'
import { logger } from '../config/logger'
import { AppError } from '../shared/errors/app-error'

export function authorizePermission(permission: string): RequestHandler {
  return (request, _response, next) => {
    if (!request.auth) {
      next(new AppError('Authentication is required', 'UNAUTHORIZED', 401))
      return
    }
    if (!request.auth.permissions.includes(permission)) {
      logger.warn('Permission denied', {
        userId: request.auth.userId,
        userType: request.auth.userType,
        tenantId: request.auth.tenantId,
        permission,
      })
      next(new AppError('Permission denied', 'FORBIDDEN', 403))
      return
    }
    next()
  }
}

export function authorizeAnyPermission(
  permissions: readonly string[],
): RequestHandler {
  return (request, _response, next) => {
    if (!request.auth) {
      next(new AppError('Authentication is required', 'UNAUTHORIZED', 401))
      return
    }
    if (
      !permissions.some((permission) =>
        request.auth!.permissions.includes(permission),
      )
    ) {
      logger.warn('Permission denied', {
        userId: request.auth.userId,
        userType: request.auth.userType,
        tenantId: request.auth.tenantId,
        permissions,
      })
      next(new AppError('Permission denied', 'FORBIDDEN', 403))
      return
    }
    next()
  }
}
