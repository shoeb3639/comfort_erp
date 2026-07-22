import type { RequestHandler } from 'express'
import { AppError } from '../shared/errors/app-error'

export const checkTenantStatus: RequestHandler = (request, _response, next) => {
  if (!request.tenant) {
    next(new AppError('Tenant context is required', 'UNAUTHORIZED', 401))
    return
  }

  if (request.tenant.status === 'SUSPENDED') {
    next(new AppError('Tenant account is suspended', 'TENANT_SUSPENDED', 403))
    return
  }
  if (request.tenant.status === 'CLOSED') {
    next(new AppError('Tenant account is closed', 'FORBIDDEN', 403))
    return
  }
  if (request.tenant.status === 'PENDING_SETUP') {
    next(new AppError('Tenant setup is incomplete', 'TENANT_INACTIVE', 403))
    return
  }

  next()
}
