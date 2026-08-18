import { Prisma } from '../../generated/prisma/client'
import { TENANT_PERMISSIONS } from '../auth/auth.constants'
import { AppError } from '../../shared/errors/app-error'
import type { PageRequest } from '../../shared/pagination'
import { hashPassword } from '../../shared/security/password'
import * as registrationRepository from './tenant-registration.repository'
import type {
  RegisterTenantInput,
  RegistrationMetadata,
  ResolvedSubscription,
} from './tenant-registration.types'

function resolveSubscription(
  input: RegisterTenantInput,
  plan: NonNullable<
    Awaited<ReturnType<typeof registrationRepository.findSubscriptionPlan>>
  >,
): ResolvedSubscription {
  const amount = input.subscription.amount ?? Number(plan.basePrice)
  const calculatedFinalAmount =
    amount - input.subscription.discountAmount + input.subscription.taxAmount
  const finalAmount = input.subscription.finalAmount ?? calculatedFinalAmount

  if (calculatedFinalAmount < 0) {
    throw new AppError(
      'Subscription discount cannot exceed amount plus tax',
      'VALIDATION_ERROR',
      400,
    )
  }
  if (Math.abs(finalAmount - calculatedFinalAmount) > 0.009) {
    throw new AppError(
      'Subscription finalAmount does not match amount - discountAmount + taxAmount',
      'VALIDATION_ERROR',
      400,
    )
  }
  if (
    input.subscription.status === 'TRIAL' &&
    !input.subscription.trialEndsAt
  ) {
    throw new AppError(
      'trialEndsAt is required for a trial subscription',
      'VALIDATION_ERROR',
      400,
    )
  }

  return {
    billingCycle: input.subscription.billingCycle ?? plan.billingCycle,
    amount,
    finalAmount,
    ...((input.subscription.userLimit ?? plan.userLimit) !== null &&
    (input.subscription.userLimit ?? plan.userLimit) !== undefined
      ? { userLimit: (input.subscription.userLimit ?? plan.userLimit)! }
      : {}),
    ...((input.subscription.vehicleLimit ?? plan.vehicleLimit) !== null &&
    (input.subscription.vehicleLimit ?? plan.vehicleLimit) !== undefined
      ? {
          vehicleLimit: (input.subscription.vehicleLimit ?? plan.vehicleLimit)!,
        }
      : {}),
    ...((input.subscription.bookingLimit ?? plan.bookingLimit) !== null &&
    (input.subscription.bookingLimit ?? plan.bookingLimit) !== undefined
      ? {
          bookingLimit: (input.subscription.bookingLimit ?? plan.bookingLimit)!,
        }
      : {}),
    ...((input.subscription.storageLimitMb ?? plan.storageLimitMb) !== null &&
    (input.subscription.storageLimitMb ?? plan.storageLimitMb) !== undefined
      ? {
          storageLimitMb: (input.subscription.storageLimitMb ??
            plan.storageLimitMb)!,
        }
      : {}),
  }
}

export async function registerTenant(
  input: RegisterTenantInput,
  metadata: RegistrationMetadata,
) {
  const [plan, permissionKeys] = await Promise.all([
    registrationRepository.findSubscriptionPlan(input.subscription.planId),
    registrationRepository.findTenantPermissionKeys(),
  ])
  if (!plan) {
    throw new AppError('Subscription plan was not found', 'NOT_FOUND', 404)
  }
  if (!plan.isActive) {
    throw new AppError(
      'Subscription plan is not active',
      'INVALID_SUBSCRIPTION_PLAN',
      409,
    )
  }

  const requiredPermissionKeys = TENANT_PERMISSIONS.map(
    ([module, action]) => `${module}.${action}`,
  )
  const missingPermissions = requiredPermissionKeys.filter(
    (key) => !permissionKeys.includes(key),
  )
  if (missingPermissions.length > 0) {
    throw new AppError(
      'Tenant permission catalog is not initialized',
      'CONFIGURATION_ERROR',
      500,
      missingPermissions.map((permission) => ({ permission })),
    )
  }

  const resolved = resolveSubscription(input, plan)
  const passwordHash = await hashPassword(input.owner.password)

  try {
    const result = await registrationRepository.createTenantRegistration(
      input,
      resolved,
      passwordHash,
      metadata,
    )
    if (!result) {
      throw new AppError(
        'Subscription plan is not active',
        'INVALID_SUBSCRIPTION_PLAN',
        409,
      )
    }
    return result
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new AppError('Tenant owner email already exists', 'CONFLICT', 409)
    }
    throw error
  }
}

export function listActiveSubscriptionPlans() {
  return registrationRepository.listActiveSubscriptionPlans()
}

export function listTenants(
  filters: PageRequest & {
    search?: string
    status?: string
  },
) {
  return registrationRepository.listTenants(filters)
}

export async function getTenantDetail(tenantId: string) {
  const tenant = await registrationRepository.findTenantDetail(tenantId)
  if (!tenant) throw new AppError('Tenant was not found', 'NOT_FOUND', 404)
  return tenant
}
