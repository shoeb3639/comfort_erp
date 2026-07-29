import { Prisma } from '../../generated/prisma/client'
import type {
  BillingCycle,
  PaymentStatus,
  SubscriptionStatus,
  UserStatus,
} from '../../generated/prisma/enums'
import { AppError } from '../../shared/errors/app-error'
import { hashPassword } from '../../shared/security/password'
import * as repository from './platform.repository'

export interface PlanInput {
  code?: string
  name?: string
  description?: string | null
  billingCycle?: BillingCycle
  basePrice?: number
  validityDays?: number | null
  userLimit?: number | null
  vehicleLimit?: number | null
  bookingLimit?: number | null
  storageLimitMb?: number | null
  trialDays?: number
  isActive?: boolean
}

export interface SubscriptionInput {
  tenantId?: string
  planId?: string
  status?: SubscriptionStatus
  billingCycle?: BillingCycle
  startsAt?: Date
  expiresAt?: Date
  trialEndsAt?: Date | null
  graceEndsAt?: Date | null
  userLimit?: number | null
  vehicleLimit?: number | null
  bookingLimit?: number | null
  storageLimitMb?: number | null
  currency?: string
  amount?: number
  discountAmount?: number
  taxAmount?: number
  finalAmount?: number
  paymentStatus?: PaymentStatus
}

export interface OwnerInput {
  name: string
  email: string
  mobile?: string
  designation?: string
  password: string
  status: UserStatus
}

export interface TenantUpdateInput {
  legalName?: string
  tradeName?: string | null
  businessType?: string | null
  email?: string
  mobile?: string
  alternateNumber?: string | null
  website?: string | null
  logoUrl?: string | null
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  state?: string | null
  pinCode?: string | null
  country?: string
  gstin?: string | null
  pan?: string | null
  companyRegistrationNumber?: string | null
  stateCode?: string | null
  taxRegistrationType?: string | null
  defaultCurrency?: string
  timeZone?: string
  financialYearStartMonth?: number
  dateFormat?: string
  invoicePrefix?: string | null
  invoiceNumberLength?: number
}

export type OwnerUpdateInput = Partial<
  Pick<OwnerInput, 'name' | 'email' | 'mobile' | 'designation' | 'status'>
>

export type CreatePlanInput = Required<
  Pick<PlanInput, 'code' | 'name' | 'billingCycle' | 'basePrice'>
> &
  PlanInput

export type CreateSubscriptionInput = Required<
  Pick<
    SubscriptionInput,
    'tenantId' | 'planId' | 'status' | 'startsAt' | 'expiresAt'
  >
> &
  SubscriptionInput

interface Metadata {
  actorUserId: string
  ipAddress: string | null
}

const transitions: Record<SubscriptionStatus, SubscriptionStatus[]> = {
  TRIAL: ['ACTIVE', 'EXPIRED', 'SUSPENDED', 'CANCELLED'],
  ACTIVE: ['GRACE_PERIOD', 'EXPIRED', 'SUSPENDED', 'CANCELLED'],
  GRACE_PERIOD: ['ACTIVE', 'EXPIRED', 'SUSPENDED', 'CANCELLED'],
  EXPIRED: ['ACTIVE', 'CANCELLED'],
  SUSPENDED: ['ACTIVE', 'EXPIRED', 'CANCELLED'],
  CANCELLED: [],
}

function conflict(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    throw new AppError(
      'A record with the same unique value already exists',
      'CONFLICT',
      409,
    )
  }
  throw error
}

function ensureDates(
  startsAt: Date,
  expiresAt: Date,
  trialEndsAt?: Date | null,
  graceEndsAt?: Date | null,
) {
  if (expiresAt <= startsAt)
    throw new AppError(
      'expiresAt must be after startsAt',
      'VALIDATION_ERROR',
      400,
    )
  if (trialEndsAt && (trialEndsAt < startsAt || trialEndsAt > expiresAt))
    throw new AppError(
      'trialEndsAt must be within the subscription period',
      'VALIDATION_ERROR',
      400,
    )
  if (graceEndsAt && graceEndsAt <= expiresAt)
    throw new AppError(
      'graceEndsAt must be after expiresAt',
      'VALIDATION_ERROR',
      400,
    )
}

function amounts(
  amount: number,
  discount: number,
  tax: number,
  suppliedFinal?: number,
) {
  const calculated = amount - discount + tax
  if (calculated < 0)
    throw new AppError(
      'Discount cannot exceed amount plus tax',
      'VALIDATION_ERROR',
      400,
    )
  if (
    suppliedFinal !== undefined &&
    Math.abs(suppliedFinal - calculated) > 0.009
  )
    throw new AppError(
      'finalAmount does not match amount - discountAmount + taxAmount',
      'VALIDATION_ERROR',
      400,
    )
  return calculated
}

export const listPlans = repository.listPlans

export async function createPlan(input: CreatePlanInput, metadata: Metadata) {
  try {
    return await repository.createPlan(
      {
        ...input,
        createdById: metadata.actorUserId,
        updatedById: metadata.actorUserId,
      },
      metadata.actorUserId,
      metadata.ipAddress,
    )
  } catch (error) {
    return conflict(error)
  }
}

export async function updatePlan(
  id: string,
  input: PlanInput,
  metadata: Metadata,
) {
  try {
    const result = await repository.updatePlan(
      id,
      { ...input, updatedById: metadata.actorUserId },
      metadata.actorUserId,
      metadata.ipAddress,
    )
    if (!result)
      throw new AppError('Subscription plan was not found', 'NOT_FOUND', 404)
    return result
  } catch (error) {
    if (error instanceof AppError) throw error
    return conflict(error)
  }
}

export function deactivatePlan(id: string, metadata: Metadata) {
  return updatePlan(id, { isActive: false }, metadata)
}

export const listSubscriptions = repository.listSubscriptions
export const listAuditLogs = repository.listAuditLogs

export async function createSubscription(
  input: CreateSubscriptionInput,
  metadata: Metadata,
) {
  const [tenant, plan, current] = await Promise.all([
    repository.findTenant(input.tenantId),
    repository.findPlan(input.planId),
    repository.findCurrentSubscription(input.tenantId),
  ])
  if (!tenant) throw new AppError('Tenant was not found', 'NOT_FOUND', 404)
  if (!plan)
    throw new AppError('Subscription plan was not found', 'NOT_FOUND', 404)
  if (!plan.isActive)
    throw new AppError(
      'Subscription plan is not active',
      'INVALID_SUBSCRIPTION_PLAN',
      409,
    )
  if (current)
    throw new AppError(
      'Tenant already has a current subscription',
      'CURRENT_SUBSCRIPTION_EXISTS',
      409,
    )
  ensureDates(
    input.startsAt,
    input.expiresAt,
    input.trialEndsAt,
    input.graceEndsAt,
  )
  if (input.status === 'TRIAL' && !input.trialEndsAt)
    throw new AppError(
      'trialEndsAt is required for a trial subscription',
      'VALIDATION_ERROR',
      400,
    )
  const amount = input.amount ?? Number(plan.basePrice)
  const discountAmount = input.discountAmount ?? 0
  const taxAmount = input.taxAmount ?? 0
  const finalAmount = amounts(
    amount,
    discountAmount,
    taxAmount,
    input.finalAmount,
  )
  return repository.createSubscription(
    {
      tenantId: input.tenantId,
      planId: input.planId,
      status: input.status,
      billingCycle: input.billingCycle ?? plan.billingCycle,
      startsAt: input.startsAt,
      expiresAt: input.expiresAt,
      currency: input.currency ?? 'INR',
      amount,
      discountAmount,
      taxAmount,
      finalAmount,
      paymentStatus: input.paymentStatus ?? 'PENDING',
      createdById: metadata.actorUserId,
      updatedById: metadata.actorUserId,
      ...(input.trialEndsAt !== undefined
        ? { trialEndsAt: input.trialEndsAt }
        : {}),
      ...(input.graceEndsAt !== undefined
        ? { graceEndsAt: input.graceEndsAt }
        : {}),
      userLimit: input.userLimit ?? plan.userLimit,
      vehicleLimit: input.vehicleLimit ?? plan.vehicleLimit,
      bookingLimit: input.bookingLimit ?? plan.bookingLimit,
      storageLimitMb: input.storageLimitMb ?? plan.storageLimitMb,
    },
    metadata.actorUserId,
    metadata.ipAddress,
  )
}

export async function updateSubscription(
  id: string,
  input: SubscriptionInput,
  metadata: Metadata,
) {
  const current = await repository.findSubscription(id)
  if (!current)
    throw new AppError('Tenant subscription was not found', 'NOT_FOUND', 404)
  if (
    input.status &&
    input.status !== current.status &&
    !transitions[current.status].includes(input.status)
  )
    throw new AppError(
      `Subscription cannot transition from ${current.status} to ${input.status}`,
      'INVALID_STATUS_TRANSITION',
      409,
    )
  const plan = input.planId
    ? await repository.findPlan(input.planId)
    : current.plan
  if (!plan)
    throw new AppError('Subscription plan was not found', 'NOT_FOUND', 404)
  if (input.planId && input.planId !== current.planId && !plan.isActive)
    throw new AppError(
      'Subscription plan is not active',
      'INVALID_SUBSCRIPTION_PLAN',
      409,
    )
  const startsAt = input.startsAt ?? current.startsAt
  const expiresAt = input.expiresAt ?? current.expiresAt
  const trialEndsAt =
    input.trialEndsAt === undefined ? current.trialEndsAt : input.trialEndsAt
  const graceEndsAt =
    input.graceEndsAt === undefined ? current.graceEndsAt : input.graceEndsAt
  ensureDates(startsAt, expiresAt, trialEndsAt, graceEndsAt)
  const status = input.status ?? current.status
  if (status === 'TRIAL' && !trialEndsAt)
    throw new AppError(
      'trialEndsAt is required for a trial subscription',
      'VALIDATION_ERROR',
      400,
    )
  const amount = input.amount ?? Number(current.amount)
  const discountAmount = input.discountAmount ?? Number(current.discountAmount)
  const taxAmount = input.taxAmount ?? Number(current.taxAmount)
  const finalAmount = amounts(
    amount,
    discountAmount,
    taxAmount,
    input.finalAmount,
  )
  const result = await repository.updateSubscription(
    id,
    {
      ...input,
      startsAt,
      expiresAt,
      trialEndsAt,
      graceEndsAt,
      status,
      amount,
      discountAmount,
      taxAmount,
      finalAmount,
      ...(input.planId
        ? { billingCycle: input.billingCycle ?? plan.billingCycle }
        : {}),
      updatedById: metadata.actorUserId,
    },
    metadata.actorUserId,
    metadata.ipAddress,
  )
  return result!
}

export async function createOwner(
  tenantId: string,
  input: OwnerInput,
  metadata: Metadata,
) {
  const passwordHash = await hashPassword(input.password)
  try {
    const result = await repository.createOwner(
      tenantId,
      {
        name: input.name,
        email: input.email,
        passwordHash,
        isPrimaryOwner: true,
        status: input.status,
        createdById: metadata.actorUserId,
        updatedById: metadata.actorUserId,
        ...(input.mobile ? { mobile: input.mobile } : {}),
        ...(input.designation ? { designation: input.designation } : {}),
      },
      metadata.actorUserId,
      metadata.ipAddress,
    )
    if (result.state === 'TENANT_NOT_FOUND')
      throw new AppError('Tenant was not found', 'NOT_FOUND', 404)
    if (result.state === 'OWNER_EXISTS')
      throw new AppError(
        'Tenant already has a primary owner',
        'PRIMARY_OWNER_EXISTS',
        409,
      )
    if (result.state === 'ROLE_NOT_FOUND')
      throw new AppError(
        'Tenant Super Admin role is not initialized',
        'CONFIGURATION_ERROR',
        500,
      )
    return result.owner
  } catch (error) {
    if (error instanceof AppError) throw error
    return conflict(error)
  }
}

export async function updateTenant(
  tenantId: string,
  input: TenantUpdateInput,
  metadata: Metadata,
) {
  try {
    const tenant = await repository.updateTenant(
      tenantId,
      input,
      metadata.actorUserId,
      metadata.ipAddress,
    )
    if (!tenant) throw new AppError('Tenant was not found', 'NOT_FOUND', 404)
    return tenant
  } catch (error) {
    if (error instanceof AppError) throw error
    return conflict(error)
  }
}

export async function updateOwner(
  tenantId: string,
  ownerId: string,
  input: OwnerUpdateInput,
  metadata: Metadata,
) {
  try {
    const owner = await repository.updateOwner(
      tenantId,
      ownerId,
      input,
      metadata.actorUserId,
      metadata.ipAddress,
    )
    if (!owner)
      throw new AppError('Tenant owner was not found', 'NOT_FOUND', 404)
    return owner
  } catch (error) {
    if (error instanceof AppError) throw error
    return conflict(error)
  }
}

export async function updateTenantStatus(
  tenantId: string,
  status: 'ACTIVE' | 'SUSPENDED',
  reason: string,
  permissions: string[],
  metadata: Metadata,
) {
  const required = status === 'SUSPENDED' ? 'tenant.suspend' : 'tenant.update'
  if (!permissions.includes(required))
    throw new AppError('Permission denied', 'FORBIDDEN', 403)
  if (status === 'ACTIVE') {
    const readiness = await repository.tenantActivationReadiness(tenantId)
    if (!readiness.hasOwner || !readiness.hasUsableSubscription) {
      throw new AppError(
        'Tenant requires a primary owner and usable subscription before activation',
        'TENANT_NOT_READY',
        409,
        [readiness],
      )
    }
  }
  const tenant = await repository.updateTenantStatus(
    tenantId,
    status,
    reason,
    metadata.actorUserId,
    metadata.ipAddress,
  )
  if (!tenant) throw new AppError('Tenant was not found', 'NOT_FOUND', 404)
  return tenant
}
