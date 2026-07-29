import type { RequestHandler } from 'express'
import { AppError } from '../../shared/errors/app-error'
import * as registrationService from './tenant-registration.service'
import type { RegisterTenantInput } from './tenant-registration.types'

export const registerTenant: RequestHandler = async (request, response) => {
  if (!request.auth) {
    throw new AppError('Authentication is required', 'UNAUTHORIZED', 401)
  }

  const result = await registrationService.registerTenant(
    request.body as RegisterTenantInput,
    {
      actorUserId: request.auth.userId,
      ipAddress: request.ip ?? null,
    },
  )

  response.status(201).json({
    success: true,
    data: result,
    message: 'Tenant registered successfully',
  })
}

export const listSubscriptionPlans: RequestHandler = async (
  _request,
  response,
) => {
  const plans = await registrationService.listActiveSubscriptionPlans()
  response.status(200).json({
    success: true,
    data: plans,
    message: 'Subscription plans retrieved',
  })
}

export const listTenants: RequestHandler = async (_request, response) => {
  const tenants = await registrationService.listTenants()
  response.status(200).json({
    success: true,
    data: tenants,
    message: 'Tenants retrieved',
  })
}

export const getTenantDetail: RequestHandler = async (request, response) => {
  const tenantId = request.params.tenantId
  if (typeof tenantId !== 'string') {
    throw new AppError('Invalid tenant ID', 'VALIDATION_ERROR', 400)
  }
  const tenant = await registrationService.getTenantDetail(tenantId)
  response.status(200).json({
    success: true,
    data: tenant,
    message: 'Tenant retrieved',
  })
}
