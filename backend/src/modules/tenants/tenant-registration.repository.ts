import type { Prisma } from '../../generated/prisma/client'
import { prisma } from '../../config/prisma'
import type { PageRequest } from '../../shared/pagination'
import { pageResult, pageWindow } from '../../shared/pagination'
import { TENANT_SYSTEM_ROLES } from '../auth/auth.constants'
import { TENANT_ONBOARDING_ITEMS } from './tenant-registration.constants'
import type {
  RegisterTenantInput,
  RegistrationMetadata,
  ResolvedSubscription,
} from './tenant-registration.types'

export function findSubscriptionPlan(planId: string) {
  return prisma.subscriptionPlan.findUnique({ where: { id: planId } })
}

export async function findTenantPermissionKeys(): Promise<string[]> {
  const permissions = await prisma.permission.findMany({
    select: { permissionKey: true },
  })
  return permissions.map((permission) => permission.permissionKey)
}

export function listActiveSubscriptionPlans() {
  return prisma.subscriptionPlan.findMany({
    where: { isActive: true },
    orderBy: [{ basePrice: 'asc' }, { name: 'asc' }],
  })
}

export async function listTenants(
  filters: PageRequest & { search?: string; status?: string },
) {
  const where = {
    ...(filters.status ? { status: filters.status as never } : {}),
    ...(filters.search
      ? {
          OR: [
            {
              code: { contains: filters.search, mode: 'insensitive' as const },
            },
            {
              legalName: {
                contains: filters.search,
                mode: 'insensitive' as const,
              },
            },
            {
              tradeName: {
                contains: filters.search,
                mode: 'insensitive' as const,
              },
            },
            {
              city: { contains: filters.search, mode: 'insensitive' as const },
            },
          ],
        }
      : {}),
  } satisfies Prisma.TenantWhereInput
  const [items, total] = await Promise.all([
    prisma.tenant.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        users: {
          where: { isPrimaryOwner: true, deletedAt: null },
          take: 1,
          select: {
            id: true,
            name: true,
            email: true,
            mobile: true,
            designation: true,
            status: true,
          },
        },
        subscriptions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { plan: { select: { id: true, code: true, name: true } } },
        },
      },
      ...pageWindow(filters),
    }),
    prisma.tenant.count({ where }),
  ])
  return pageResult(items, total, filters)
}

export function findTenantDetail(tenantId: string) {
  return prisma.tenant.findUnique({
    where: { id: tenantId },
    include: {
      users: {
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          email: true,
          mobile: true,
          designation: true,
          isPrimaryOwner: true,
          status: true,
          role: { select: { id: true, code: true, name: true } },
          createdAt: true,
        },
      },
      subscriptions: {
        orderBy: { createdAt: 'desc' },
        include: {
          plan: { select: { id: true, code: true, name: true } },
        },
      },
      onboardingItems: { orderBy: { createdAt: 'asc' } },
      roles: {
        where: { deletedAt: null },
        select: { id: true, code: true, name: true, status: true },
      },
    },
  })
}

export async function createTenantRegistration(
  input: RegisterTenantInput,
  resolved: ResolvedSubscription,
  passwordHash: string,
  metadata: RegistrationMetadata,
) {
  return prisma.$transaction(async (transaction) => {
    const plan = await transaction.subscriptionPlan.findUnique({
      where: { id: input.subscription.planId },
      select: { id: true, isActive: true },
    })
    if (!plan?.isActive) return null

    const [tenantCodeSequence] = await transaction.$queryRaw<
      Array<{ value: bigint }>
    >`SELECT nextval('tenant_code_seq') AS value`
    if (!tenantCodeSequence) {
      throw new Error('Tenant code sequence did not return a value')
    }
    const tenantCode = `TEN${tenantCodeSequence.value.toString().padStart(6, '0')}`

    const tenant = await transaction.tenant.create({
      data: {
        code: tenantCode,
        legalName: input.tenant.legalName,
        email: input.tenant.email,
        mobile: input.tenant.mobile,
        country: input.tenant.country,
        defaultCurrency: input.tenant.defaultCurrency,
        timeZone: input.tenant.timeZone,
        financialYearStartMonth: input.tenant.financialYearStartMonth,
        dateFormat: input.tenant.dateFormat,
        invoiceNumberLength: input.tenant.invoiceNumberLength,
        status: input.tenant.status,
        onboardingStatus: 'NOT_STARTED',
        createdById: metadata.actorUserId,
        updatedById: metadata.actorUserId,
        ...(input.tenant.tradeName
          ? { tradeName: input.tenant.tradeName }
          : {}),
        ...(input.tenant.alternateNumber
          ? { alternateNumber: input.tenant.alternateNumber }
          : {}),
        ...(input.tenant.website ? { website: input.tenant.website } : {}),
        ...(input.tenant.logoUrl ? { logoUrl: input.tenant.logoUrl } : {}),
        ...(input.tenant.addressLine1
          ? { addressLine1: input.tenant.addressLine1 }
          : {}),
        ...(input.tenant.addressLine2
          ? { addressLine2: input.tenant.addressLine2 }
          : {}),
        ...(input.tenant.city ? { city: input.tenant.city } : {}),
        ...(input.tenant.state ? { state: input.tenant.state } : {}),
        ...(input.tenant.pinCode ? { pinCode: input.tenant.pinCode } : {}),
        ...(input.tenant.gstin ? { gstin: input.tenant.gstin } : {}),
        ...(input.tenant.pan ? { pan: input.tenant.pan } : {}),
        ...(input.tenant.companyRegistrationNumber
          ? {
              companyRegistrationNumber: input.tenant.companyRegistrationNumber,
            }
          : {}),
        ...(input.tenant.stateCode
          ? { stateCode: input.tenant.stateCode }
          : {}),
        ...(input.tenant.taxRegistrationType
          ? { taxRegistrationType: input.tenant.taxRegistrationType }
          : {}),
        ...(input.tenant.billingAddress
          ? {
              billingAddress: input.tenant
                .billingAddress as Prisma.InputJsonValue,
            }
          : {}),
        ...(input.tenant.invoicePrefix
          ? { invoicePrefix: input.tenant.invoicePrefix }
          : {}),
        ...(input.tenant.taxSettings
          ? { taxSettings: input.tenant.taxSettings as Prisma.InputJsonValue }
          : {}),
      },
    })

    const permissions = await transaction.permission.findMany({
      select: { id: true, permissionKey: true },
    })
    const permissionByKey = new Map(
      permissions.map((permission) => [
        permission.permissionKey,
        permission.id,
      ]),
    )

    let ownerRoleId: string | null = null
    for (const roleDefinition of TENANT_SYSTEM_ROLES) {
      const role = await transaction.tenantRole.create({
        data: {
          tenantId: tenant.id,
          name: roleDefinition.name,
          code: roleDefinition.code,
          isSystemRole: true,
          status: 'ACTIVE',
          createdById: metadata.actorUserId,
          updatedById: metadata.actorUserId,
        },
      })
      if (roleDefinition.code === 'SUPER_ADMIN') ownerRoleId = role.id

      await transaction.tenantRolePermission.createMany({
        data: roleDefinition.permissions.map((permissionKey) => ({
          tenantId: tenant.id,
          roleId: role.id,
          permissionId: permissionByKey.get(permissionKey)!,
          createdById: metadata.actorUserId,
        })),
      })
    }

    const owner = await transaction.tenantUser.create({
      data: {
        tenantId: tenant.id,
        roleId: ownerRoleId!,
        name: input.owner.name,
        email: input.owner.email,
        passwordHash,
        isPrimaryOwner: true,
        status: 'ACTIVE',
        createdById: metadata.actorUserId,
        updatedById: metadata.actorUserId,
        ...(input.owner.mobile ? { mobile: input.owner.mobile } : {}),
        ...(input.owner.designation
          ? { designation: input.owner.designation }
          : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        mobile: true,
        designation: true,
        isPrimaryOwner: true,
        status: true,
      },
    })

    const subscription = await transaction.tenantSubscription.create({
      data: {
        tenantId: tenant.id,
        planId: input.subscription.planId,
        status: input.subscription.status,
        billingCycle: resolved.billingCycle,
        startsAt: input.subscription.startsAt,
        expiresAt: input.subscription.expiresAt,
        currency: input.subscription.currency,
        amount: resolved.amount,
        discountAmount: input.subscription.discountAmount,
        taxAmount: input.subscription.taxAmount,
        finalAmount: resolved.finalAmount,
        paymentStatus: input.subscription.paymentStatus,
        createdById: metadata.actorUserId,
        updatedById: metadata.actorUserId,
        ...(input.subscription.trialEndsAt
          ? { trialEndsAt: input.subscription.trialEndsAt }
          : {}),
        ...(input.subscription.graceEndsAt
          ? { graceEndsAt: input.subscription.graceEndsAt }
          : {}),
        ...(resolved.userLimit !== undefined
          ? { userLimit: resolved.userLimit }
          : {}),
        ...(resolved.vehicleLimit !== undefined
          ? { vehicleLimit: resolved.vehicleLimit }
          : {}),
        ...(resolved.bookingLimit !== undefined
          ? { bookingLimit: resolved.bookingLimit }
          : {}),
        ...(resolved.storageLimitMb !== undefined
          ? { storageLimitMb: resolved.storageLimitMb }
          : {}),
      },
      include: { plan: { select: { id: true, code: true, name: true } } },
    })

    await transaction.tenantOnboardingItem.createMany({
      data: TENANT_ONBOARDING_ITEMS.map((item) => ({
        tenantId: tenant.id,
        code: item.code,
        label: item.label,
      })),
    })

    await transaction.platformAuditLog.create({
      data: {
        actorUserId: metadata.actorUserId,
        action: 'CREATE',
        module: 'TENANT',
        referenceId: tenant.id,
        newValues: {
          tenantCode: tenant.code,
          ownerEmail: owner.email,
          subscriptionId: subscription.id,
          planId: subscription.planId,
        },
        remarks: 'Tenant registered with primary owner and subscription',
        ipAddress: metadata.ipAddress,
      },
    })

    return { tenant, owner, subscription }
  })
}
