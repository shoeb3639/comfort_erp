import type { RequestHandler } from 'express'
import { AppError } from '../../shared/errors/app-error'
import { pageRequest } from '../../shared/pagination'
import * as service from './platform.service'
import type {
  CreatePlanInput,
  CreateSubscriptionInput,
  OwnerInput,
  OwnerUpdateInput,
  PlanInput,
  SubscriptionInput,
  TenantUpdateInput,
} from './platform.service'

function metadata(request: Parameters<RequestHandler>[0]) {
  if (!request.auth)
    throw new AppError('Authentication is required', 'UNAUTHORIZED', 401)
  return { actorUserId: request.auth.userId, ipAddress: request.ip ?? null }
}

function success(
  response: Parameters<RequestHandler>[1],
  data: unknown,
  message: string,
  status = 200,
) {
  response.status(status).json({ success: true, data, message })
}

function param(value: string | string[] | undefined): string {
  if (typeof value !== 'string')
    throw new AppError('Invalid route parameter', 'VALIDATION_ERROR', 400)
  return value
}

export const listPlans: RequestHandler = async (_request, response) =>
  success(response, await service.listPlans(), 'Subscription plans retrieved')
export const createPlan: RequestHandler = async (request, response) =>
  success(
    response,
    await service.createPlan(
      request.body as CreatePlanInput,
      metadata(request),
    ),
    'Subscription plan created',
    201,
  )
export const updatePlan: RequestHandler = async (request, response) =>
  success(
    response,
    await service.updatePlan(
      param(request.params.planId),
      request.body as PlanInput,
      metadata(request),
    ),
    'Subscription plan updated',
  )
export const deactivatePlan: RequestHandler = async (request, response) =>
  success(
    response,
    await service.deactivatePlan(
      param(request.params.planId),
      metadata(request),
    ),
    'Subscription plan deactivated',
  )

export const listSubscriptions: RequestHandler = async (request, response) => {
  const tenantId =
    typeof request.query.tenantId === 'string'
      ? request.query.tenantId
      : undefined
  success(
    response,
    await service.listSubscriptions({
      ...pageRequest(request.query),
      ...(tenantId ? { tenantId } : {}),
    }),
    'Tenant subscriptions retrieved',
  )
}
export const createSubscription: RequestHandler = async (request, response) =>
  success(
    response,
    await service.createSubscription(
      request.body as CreateSubscriptionInput,
      metadata(request),
    ),
    'Tenant subscription created',
    201,
  )
export const updateSubscription: RequestHandler = async (request, response) =>
  success(
    response,
    await service.updateSubscription(
      param(request.params.subscriptionId),
      request.body as SubscriptionInput,
      metadata(request),
    ),
    'Tenant subscription updated',
  )

export const createOwner: RequestHandler = async (request, response) =>
  success(
    response,
    await service.createOwner(
      param(request.params.tenantId),
      request.body as OwnerInput,
      metadata(request),
    ),
    'Tenant owner created',
    201,
  )

export const updateTenant: RequestHandler = async (request, response) =>
  success(
    response,
    await service.updateTenant(
      param(request.params.tenantId),
      request.body as TenantUpdateInput,
      metadata(request),
    ),
    'Tenant updated',
  )

export const updateOwner: RequestHandler = async (request, response) =>
  success(
    response,
    await service.updateOwner(
      param(request.params.tenantId),
      param(request.params.ownerId),
      request.body as OwnerUpdateInput,
      metadata(request),
    ),
    'Tenant owner updated',
  )

export const listAuditLogs: RequestHandler = async (request, response) =>
  success(
    response,
    await service.listAuditLogs(pageRequest(request.query)),
    'Platform audit logs retrieved',
  )

export const listPlatformUsers: RequestHandler = async (request, response) =>
  success(
    response,
    await service.listPlatformUsers(pageRequest(request.query)),
    'Platform users retrieved',
  )

export const listSubscriptionPayments: RequestHandler = async (
  request,
  response,
) =>
  success(
    response,
    await service.listSubscriptionPayments(pageRequest(request.query)),
    'Subscription payments retrieved',
  )

export const updateTenantStatus: RequestHandler = async (request, response) => {
  if (!request.auth)
    throw new AppError('Authentication is required', 'UNAUTHORIZED', 401)
  const body = request.body as {
    status: 'ACTIVE' | 'SUSPENDED'
    reason: string
  }
  success(
    response,
    await service.updateTenantStatus(
      param(request.params.tenantId),
      body.status,
      body.reason,
      request.auth.permissions,
      metadata(request),
    ),
    `Tenant ${body.status === 'ACTIVE' ? 'activated' : 'suspended'}`,
  )
}
