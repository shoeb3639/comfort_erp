import type { Prisma } from '../../generated/prisma/client'
import { prisma } from '../../config/prisma'

export function listPlans() {
  return prisma.subscriptionPlan.findMany({
    orderBy: [{ isActive: 'desc' }, { basePrice: 'asc' }, { name: 'asc' }],
  })
}

export function findPlan(id: string) {
  return prisma.subscriptionPlan.findUnique({ where: { id } })
}

export function createPlan(
  data: Prisma.SubscriptionPlanUncheckedCreateInput,
  actorUserId: string,
  ipAddress: string | null,
) {
  return prisma.$transaction(async (transaction) => {
    const plan = await transaction.subscriptionPlan.create({ data })
    await transaction.platformAuditLog.create({
      data: {
        actorUserId,
        action: 'CREATE',
        module: 'SUBSCRIPTION_PLAN',
        referenceId: plan.id,
        newValues: { code: plan.code, name: plan.name },
        ipAddress,
      },
    })
    return plan
  })
}

export function updatePlan(
  id: string,
  data: Prisma.SubscriptionPlanUncheckedUpdateInput,
  actorUserId: string,
  ipAddress: string | null,
) {
  return prisma.$transaction(async (transaction) => {
    const previous = await transaction.subscriptionPlan.findUnique({
      where: { id },
    })
    if (!previous) return null
    const plan = await transaction.subscriptionPlan.update({
      where: { id },
      data,
    })
    await transaction.platformAuditLog.create({
      data: {
        actorUserId,
        action: 'UPDATE',
        module: 'SUBSCRIPTION_PLAN',
        referenceId: id,
        oldValues: {
          code: previous.code,
          name: previous.name,
          isActive: previous.isActive,
        },
        newValues: {
          code: plan.code,
          name: plan.name,
          isActive: plan.isActive,
        },
        ipAddress,
      },
    })
    return plan
  })
}

export function listSubscriptions(tenantId?: string) {
  return prisma.tenantSubscription.findMany({
    ...(tenantId ? { where: { tenantId } } : {}),
    orderBy: { createdAt: 'desc' },
    include: {
      tenant: {
        select: {
          id: true,
          code: true,
          legalName: true,
          tradeName: true,
          status: true,
        },
      },
      plan: { select: { id: true, code: true, name: true, isActive: true } },
    },
  })
}

export function findSubscription(id: string) {
  return prisma.tenantSubscription.findUnique({
    where: { id },
    include: { plan: true },
  })
}

export function findCurrentSubscription(tenantId: string) {
  return prisma.tenantSubscription.findFirst({
    where: {
      tenantId,
      status: { in: ['TRIAL', 'ACTIVE', 'GRACE_PERIOD', 'SUSPENDED'] },
    },
  })
}

export function findTenant(id: string) {
  return prisma.tenant.findUnique({ where: { id } })
}

export function listAuditLogs() {
  return prisma.platformAuditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
    include: {
      actor: { select: { id: true, name: true, email: true } },
    },
  })
}

export function listPlatformUsers() {
  return prisma.platformUser.findMany({
    orderBy: [{ status: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      email: true,
      mobile: true,
      designation: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
      role: { select: { id: true, name: true, code: true } },
    },
  })
}

export function listSubscriptionPayments() {
  return prisma.subscriptionPayment.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      tenantSubscription: {
        select: {
          id: true,
          tenant: {
            select: {
              id: true,
              code: true,
              legalName: true,
              tradeName: true,
            },
          },
          plan: { select: { id: true, code: true, name: true } },
        },
      },
      recordedBy: { select: { id: true, name: true, email: true } },
    },
  })
}

export function updateTenant(
  tenantId: string,
  data: Prisma.TenantUncheckedUpdateInput,
  actorUserId: string,
  ipAddress: string | null,
) {
  return prisma.$transaction(async (transaction) => {
    const previous = await transaction.tenant.findUnique({
      where: { id: tenantId },
    })
    if (!previous) return null
    const tenant = await transaction.tenant.update({
      where: { id: tenantId },
      data: { ...data, updatedById: actorUserId },
    })
    await transaction.platformAuditLog.create({
      data: {
        actorUserId,
        action: 'UPDATE',
        module: 'TENANT',
        referenceId: tenantId,
        oldValues: {
          legalName: previous.legalName,
          tradeName: previous.tradeName,
          email: previous.email,
          mobile: previous.mobile,
        },
        newValues: {
          legalName: tenant.legalName,
          tradeName: tenant.tradeName,
          email: tenant.email,
          mobile: tenant.mobile,
        },
        remarks: 'Tenant profile updated by platform administrator',
        ipAddress,
      },
    })
    return tenant
  })
}

export function updateOwner(
  tenantId: string,
  ownerId: string,
  data: Prisma.TenantUserUncheckedUpdateInput,
  actorUserId: string,
  ipAddress: string | null,
) {
  return prisma.$transaction(async (transaction) => {
    const previous = await transaction.tenantUser.findFirst({
      where: {
        id: ownerId,
        tenantId,
        isPrimaryOwner: true,
        deletedAt: null,
      },
    })
    if (!previous) return null
    const owner = await transaction.tenantUser.update({
      where: { id: ownerId },
      data: { ...data, updatedById: actorUserId },
      select: {
        id: true,
        tenantId: true,
        name: true,
        email: true,
        mobile: true,
        designation: true,
        isPrimaryOwner: true,
        status: true,
        updatedAt: true,
      },
    })
    await transaction.platformAuditLog.create({
      data: {
        actorUserId,
        action: 'UPDATE',
        module: 'TENANT_OWNER',
        referenceId: ownerId,
        oldValues: {
          tenantId,
          name: previous.name,
          email: previous.email,
          status: previous.status,
        },
        newValues: {
          tenantId,
          name: owner.name,
          email: owner.email,
          status: owner.status,
        },
        ipAddress,
      },
    })
    return owner
  })
}

export async function tenantActivationReadiness(tenantId: string) {
  const [ownerCount, subscriptionCount] = await Promise.all([
    prisma.tenantUser.count({
      where: {
        tenantId,
        isPrimaryOwner: true,
        deletedAt: null,
        status: { in: ['ACTIVE', 'PENDING_ACTIVATION'] },
      },
    }),
    prisma.tenantSubscription.count({
      where: { tenantId, status: { in: ['TRIAL', 'ACTIVE', 'GRACE_PERIOD'] } },
    }),
  ])
  return {
    hasOwner: ownerCount > 0,
    hasUsableSubscription: subscriptionCount > 0,
  }
}

export function createSubscription(
  data: Prisma.TenantSubscriptionUncheckedCreateInput,
  actorUserId: string,
  ipAddress: string | null,
) {
  return prisma.$transaction(async (transaction) => {
    const subscription = await transaction.tenantSubscription.create({
      data,
      include: {
        plan: { select: { id: true, code: true, name: true } },
        tenant: { select: { id: true, code: true, legalName: true } },
      },
    })
    await transaction.platformAuditLog.create({
      data: {
        actorUserId,
        action: 'CREATE',
        module: 'TENANT_SUBSCRIPTION',
        referenceId: subscription.id,
        newValues: {
          tenantId: subscription.tenantId,
          planId: subscription.planId,
          status: subscription.status,
        },
        ipAddress,
      },
    })
    return subscription
  })
}

export function updateSubscription(
  id: string,
  data: Prisma.TenantSubscriptionUncheckedUpdateInput,
  actorUserId: string,
  ipAddress: string | null,
) {
  return prisma.$transaction(async (transaction) => {
    const previous = await transaction.tenantSubscription.findUnique({
      where: { id },
    })
    if (!previous) return null
    const subscription = await transaction.tenantSubscription.update({
      where: { id },
      data,
      include: {
        plan: { select: { id: true, code: true, name: true } },
        tenant: { select: { id: true, code: true, legalName: true } },
      },
    })
    await transaction.platformAuditLog.create({
      data: {
        actorUserId,
        action: 'UPDATE',
        module: 'TENANT_SUBSCRIPTION',
        referenceId: id,
        oldValues: {
          planId: previous.planId,
          status: previous.status,
          expiresAt: previous.expiresAt.toISOString(),
        },
        newValues: {
          planId: subscription.planId,
          status: subscription.status,
          expiresAt: subscription.expiresAt.toISOString(),
        },
        ipAddress,
      },
    })
    return subscription
  })
}

export function createOwner(
  tenantId: string,
  data: Omit<Prisma.TenantUserUncheckedCreateInput, 'tenantId' | 'roleId'>,
  actorUserId: string,
  ipAddress: string | null,
) {
  return prisma.$transaction(async (transaction) => {
    const tenant = await transaction.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, code: true },
    })
    if (!tenant) return { state: 'TENANT_NOT_FOUND' as const }
    const existingOwner = await transaction.tenantUser.findFirst({
      where: { tenantId, isPrimaryOwner: true, deletedAt: null },
    })
    if (existingOwner) return { state: 'OWNER_EXISTS' as const }
    const role = await transaction.tenantRole.findUnique({
      where: { tenantId_code: { tenantId, code: 'SUPER_ADMIN' } },
    })
    if (!role) return { state: 'ROLE_NOT_FOUND' as const }
    const owner = await transaction.tenantUser.create({
      data: { ...data, tenantId, roleId: role.id },
      select: {
        id: true,
        tenantId: true,
        name: true,
        email: true,
        mobile: true,
        designation: true,
        isPrimaryOwner: true,
        status: true,
        createdAt: true,
      },
    })
    await transaction.platformAuditLog.create({
      data: {
        actorUserId,
        action: 'CREATE',
        module: 'TENANT_OWNER',
        referenceId: owner.id,
        newValues: { tenantId, email: owner.email },
        ipAddress,
      },
    })
    return { state: 'CREATED' as const, owner }
  })
}

export function updateTenantStatus(
  tenantId: string,
  status: 'ACTIVE' | 'SUSPENDED',
  reason: string,
  actorUserId: string,
  ipAddress: string | null,
) {
  return prisma.$transaction(async (transaction) => {
    const previous = await transaction.tenant.findUnique({
      where: { id: tenantId },
    })
    if (!previous) return null
    const tenant = await transaction.tenant.update({
      where: { id: tenantId },
      data: { status, updatedById: actorUserId },
    })
    await transaction.platformAuditLog.create({
      data: {
        actorUserId,
        action: status === 'SUSPENDED' ? 'SUSPEND' : 'ACTIVATE',
        module: 'TENANT',
        referenceId: tenantId,
        oldValues: { status: previous.status },
        newValues: { status },
        remarks: reason,
        ipAddress,
      },
    })
    return tenant
  })
}
