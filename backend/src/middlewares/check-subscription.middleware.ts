import type { RequestHandler } from 'express'
import { findCurrentSubscription } from '../modules/tenants/tenant-context.repository'
import { AppError } from '../shared/errors/app-error'

interface SubscriptionPolicy {
  allowRestrictedRead?: boolean
}

function isReadRequest(method: string): boolean {
  return ['GET', 'HEAD', 'OPTIONS'].includes(method)
}

export function checkSubscription(
  policy: SubscriptionPolicy = {},
): RequestHandler {
  return async (request, _response, next) => {
    if (!request.tenant) {
      throw new AppError('Tenant context is required', 'UNAUTHORIZED', 401)
    }

    const subscription = await findCurrentSubscription(request.tenant.id)
    const now = new Date()
    const restrictedReadAllowed =
      policy.allowRestrictedRead === true && isReadRequest(request.method)

    if (!subscription) {
      if (restrictedReadAllowed) return next()
      throw new AppError(
        'An active subscription is required',
        'SUBSCRIPTION_EXPIRED',
        403,
      )
    }

    const status = subscription.status
    const activeThrough =
      status === 'GRACE_PERIOD'
        ? subscription.graceEndsAt
        : status === 'TRIAL'
          ? (subscription.trialEndsAt ?? subscription.expiresAt)
          : subscription.expiresAt
    const statusAllowsTransactions = [
      'TRIAL',
      'ACTIVE',
      'GRACE_PERIOD',
    ].includes(status)
    const isWithinAccessPeriod = activeThrough ? activeThrough >= now : false

    if (statusAllowsTransactions && isWithinAccessPeriod) {
      next()
      return
    }
    if (restrictedReadAllowed && !['SUSPENDED', 'CANCELLED'].includes(status)) {
      next()
      return
    }

    throw new AppError(
      status === 'SUSPENDED'
        ? 'Subscription is suspended'
        : 'Subscription has expired',
      'SUBSCRIPTION_EXPIRED',
      403,
    )
  }
}
