import type { RequestHandler } from 'express'
import { findTenantContext } from '../modules/tenants/tenant-context.repository'
import { AppError } from '../shared/errors/app-error'

export const resolveTenant: RequestHandler = async (
  request,
  _response,
  next,
) => {
  if (
    !request.auth ||
    request.auth.userType !== 'TENANT' ||
    !request.auth.tenantId
  ) {
    throw new AppError('Tenant access is required', 'FORBIDDEN', 403)
  }

  const tenant = await findTenantContext(request.auth.tenantId)
  if (!tenant) {
    throw new AppError('Tenant context was not found', 'UNAUTHORIZED', 401)
  }

  request.tenant = tenant
  next()
}
