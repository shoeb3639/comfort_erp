import type { Prisma } from '../../generated/prisma/client'
import { prisma } from '../../config/prisma'

type Transaction = Prisma.TransactionClient

async function advanceOnboarding(
  transaction: Transaction,
  tenantId: string,
  code: string,
  actorUserId: string,
) {
  await transaction.tenantOnboardingItem.updateMany({
    where: { tenantId, code, isCompleted: false },
    data: {
      isCompleted: true,
      completedAt: new Date(),
      completedById: actorUserId,
    },
  })
  const [completed, remaining] = await Promise.all([
    transaction.tenantOnboardingItem.count({
      where: { tenantId, isCompleted: true },
    }),
    transaction.tenantOnboardingItem.count({
      where: { tenantId, isCompleted: false },
    }),
  ])
  await transaction.tenant.update({
    where: { id: tenantId },
    data: {
      onboardingStatus:
        remaining === 0 && completed > 0 ? 'COMPLETED' : 'IN_PROGRESS',
    },
  })
}

async function audit(
  transaction: Transaction,
  tenantId: string,
  actorUserId: string,
  module: string,
  action: string,
  referenceId: string,
) {
  await transaction.tenantAuditLog.create({
    data: { tenantId, actorUserId, module, action, referenceId },
  })
}

export function getCompanyProfile(tenantId: string) {
  return prisma.tenant.findUnique({ where: { id: tenantId } })
}

export function updateTenantSettings(
  tenantId: string,
  data: Prisma.TenantUncheckedUpdateInput,
  actorUserId: string,
  module: string,
  checklistCode: string | null,
) {
  return prisma.$transaction(async (transaction) => {
    const tenant = await transaction.tenant.update({
      where: { id: tenantId },
      // Tenant.updatedById references a platform user. Company setup changes are
      // made by tenant users and are attributed through the tenant audit log.
      data,
    })
    if (checklistCode) {
      await advanceOnboarding(transaction, tenantId, checklistCode, actorUserId)
    }
    await audit(transaction, tenantId, actorUserId, module, 'UPDATE', tenantId)
    return tenant
  })
}

export function getOnboarding(tenantId: string) {
  return prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      onboardingStatus: true,
      onboardingItems: { orderBy: { createdAt: 'asc' } },
    },
  })
}

export function listLocations(tenantId: string) {
  return prisma.tenantLocation.findMany({
    where: { tenantId },
    orderBy: [{ isPrimary: 'desc' }, { name: 'asc' }],
  })
}

export function createLocation(
  tenantId: string,
  data: Omit<Prisma.TenantLocationUncheckedCreateInput, 'tenantId'>,
  actorUserId: string,
) {
  return prisma.$transaction(async (transaction) => {
    if (data.isPrimary === true) {
      await transaction.tenantLocation.updateMany({
        where: { tenantId },
        data: { isPrimary: false },
      })
    }
    const record = await transaction.tenantLocation.create({
      data: { ...data, tenantId },
    })
    await advanceOnboarding(transaction, tenantId, 'LOCATIONS', actorUserId)
    await audit(
      transaction,
      tenantId,
      actorUserId,
      'LOCATION',
      'CREATE',
      record.id,
    )
    return record
  })
}

export function updateLocation(
  tenantId: string,
  id: string,
  data: Prisma.TenantLocationUncheckedUpdateInput,
  actorUserId: string,
) {
  return prisma.$transaction(async (transaction) => {
    const exists = await transaction.tenantLocation.findUnique({
      where: { tenantId_id: { tenantId, id } },
    })
    if (!exists) return null
    if (data.isPrimary === true) {
      await transaction.tenantLocation.updateMany({
        where: { tenantId, id: { not: id } },
        data: { isPrimary: false },
      })
    }
    const record = await transaction.tenantLocation.update({
      where: { id },
      data,
    })
    await audit(transaction, tenantId, actorUserId, 'LOCATION', 'UPDATE', id)
    return record
  })
}

export function listBankAccounts(tenantId: string) {
  return prisma.tenantBankAccount.findMany({
    where: { tenantId },
    orderBy: [{ isDefault: 'desc' }, { bankName: 'asc' }],
  })
}

export function createBankAccount(
  tenantId: string,
  data: Omit<Prisma.TenantBankAccountUncheckedCreateInput, 'tenantId'>,
  actorUserId: string,
) {
  return prisma.$transaction(async (transaction) => {
    if (data.isDefault === true) {
      await transaction.tenantBankAccount.updateMany({
        where: { tenantId },
        data: { isDefault: false },
      })
    }
    const record = await transaction.tenantBankAccount.create({
      data: { ...data, tenantId },
    })
    await advanceOnboarding(transaction, tenantId, 'BANK_ACCOUNT', actorUserId)
    await audit(
      transaction,
      tenantId,
      actorUserId,
      'BANK_ACCOUNT',
      'CREATE',
      record.id,
    )
    return record
  })
}

export function updateBankAccount(
  tenantId: string,
  id: string,
  data: Prisma.TenantBankAccountUncheckedUpdateInput,
  actorUserId: string,
) {
  return prisma.$transaction(async (transaction) => {
    const exists = await transaction.tenantBankAccount.findFirst({
      where: { tenantId, id },
    })
    if (!exists) return null
    if (data.isDefault === true) {
      await transaction.tenantBankAccount.updateMany({
        where: { tenantId, id: { not: id } },
        data: { isDefault: false },
      })
    }
    const record = await transaction.tenantBankAccount.update({
      where: { id },
      data,
    })
    await audit(
      transaction,
      tenantId,
      actorUserId,
      'BANK_ACCOUNT',
      'UPDATE',
      id,
    )
    return record
  })
}

export function listGstRegistrations(tenantId: string) {
  return prisma.gstRegistration.findMany({
    where: { tenantId },
    orderBy: [{ isDefault: 'desc' }, { registrationName: 'asc' }],
    include: {
      locations: {
        include: { location: { select: { id: true, name: true, code: true } } },
      },
    },
  })
}

export function findLocations(tenantId: string, ids: string[]) {
  return prisma.tenantLocation.findMany({
    where: { tenantId, id: { in: ids } },
    select: { id: true },
  })
}

export function createGstRegistration(
  tenantId: string,
  data: Omit<Prisma.GstRegistrationUncheckedCreateInput, 'tenantId'>,
  locationIds: string[],
  actorUserId: string,
) {
  return prisma.$transaction(async (transaction) => {
    if (data.isDefault === true) {
      await transaction.gstRegistration.updateMany({
        where: { tenantId },
        data: { isDefault: false },
      })
    }
    const record = await transaction.gstRegistration.create({
      data: { ...data, tenantId },
    })
    await transaction.gstRegistrationLocation.createMany({
      data: locationIds.map((locationId) => ({
        tenantId,
        gstRegistrationId: record.id,
        locationId,
      })),
    })
    await advanceOnboarding(
      transaction,
      tenantId,
      'GST_REGISTRATION',
      actorUserId,
    )
    await audit(
      transaction,
      tenantId,
      actorUserId,
      'GST_REGISTRATION',
      'CREATE',
      record.id,
    )
    return transaction.gstRegistration.findUniqueOrThrow({
      where: { id: record.id },
      include: {
        locations: {
          include: {
            location: { select: { id: true, name: true, code: true } },
          },
        },
      },
    })
  })
}

export function updateGstRegistration(
  tenantId: string,
  id: string,
  data: Prisma.GstRegistrationUncheckedUpdateInput,
  locationIds: string[] | undefined,
  actorUserId: string,
) {
  return prisma.$transaction(async (transaction) => {
    const exists = await transaction.gstRegistration.findUnique({
      where: { tenantId_id: { tenantId, id } },
    })
    if (!exists) return null
    if (data.isDefault === true) {
      await transaction.gstRegistration.updateMany({
        where: { tenantId, id: { not: id } },
        data: { isDefault: false },
      })
    }
    if (locationIds) {
      await transaction.gstRegistrationLocation.deleteMany({
        where: { tenantId, gstRegistrationId: id },
      })
      await transaction.gstRegistrationLocation.createMany({
        data: locationIds.map((locationId) => ({
          tenantId,
          gstRegistrationId: id,
          locationId,
        })),
      })
    }
    const record = await transaction.gstRegistration.update({
      where: { id },
      data,
      include: {
        locations: {
          include: {
            location: { select: { id: true, name: true, code: true } },
          },
        },
      },
    })
    await audit(
      transaction,
      tenantId,
      actorUserId,
      'GST_REGISTRATION',
      'UPDATE',
      id,
    )
    return record
  })
}

export function listUsers(tenantId: string) {
  return prisma.tenantUser.findMany({
    where: { tenantId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      email: true,
      mobile: true,
      designation: true,
      isPrimaryOwner: true,
      status: true,
      lastLoginAt: true,
      createdAt: true,
      role: { select: { id: true, name: true, code: true } },
      locations: {
        include: { location: { select: { id: true, name: true, code: true } } },
      },
    },
  })
}

export function findRole(tenantId: string, roleId: string) {
  return prisma.tenantRole.findUnique({
    where: { tenantId_id: { tenantId, id: roleId } },
  })
}

export function findUser(tenantId: string, userId: string) {
  return prisma.tenantUser.findUnique({
    where: { tenantId_id: { tenantId, id: userId } },
  })
}

export async function getUserCapacity(tenantId: string) {
  const [userCount, subscription] = await Promise.all([
    prisma.tenantUser.count({ where: { tenantId, deletedAt: null } }),
    prisma.tenantSubscription.findFirst({
      where: {
        tenantId,
        status: { in: ['TRIAL', 'ACTIVE', 'GRACE_PERIOD'] },
      },
      orderBy: { createdAt: 'desc' },
      select: { userLimit: true },
    }),
  ])
  return { userCount, userLimit: subscription?.userLimit ?? null }
}

export function createUser(
  tenantId: string,
  data: Omit<Prisma.TenantUserUncheckedCreateInput, 'tenantId'>,
  locationIds: string[],
  actorUserId: string,
) {
  return prisma.$transaction(async (transaction) => {
    const user = await transaction.tenantUser.create({
      data: { ...data, tenantId },
    })
    await transaction.tenantUserLocation.createMany({
      data: locationIds.map((locationId) => ({
        tenantId,
        userId: user.id,
        locationId,
      })),
    })
    await audit(
      transaction,
      tenantId,
      actorUserId,
      'TENANT_USER',
      'CREATE',
      user.id,
    )
    return transaction.tenantUser.findUniqueOrThrow({
      where: { id: user.id },
      select: {
        id: true,
        name: true,
        email: true,
        mobile: true,
        designation: true,
        isPrimaryOwner: true,
        status: true,
        createdAt: true,
        role: { select: { id: true, name: true, code: true } },
        locations: { include: { location: true } },
      },
    })
  })
}

export function updateUser(
  tenantId: string,
  id: string,
  data: Prisma.TenantUserUncheckedUpdateInput,
  locationIds: string[] | undefined,
  actorUserId: string,
) {
  return prisma.$transaction(async (transaction) => {
    const exists = await transaction.tenantUser.findUnique({
      where: { tenantId_id: { tenantId, id } },
    })
    if (!exists || exists.deletedAt) return null
    if (locationIds) {
      await transaction.tenantUserLocation.deleteMany({
        where: { tenantId, userId: id },
      })
      await transaction.tenantUserLocation.createMany({
        data: locationIds.map((locationId) => ({
          tenantId,
          userId: id,
          locationId,
        })),
      })
    }
    const user = await transaction.tenantUser.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        mobile: true,
        designation: true,
        isPrimaryOwner: true,
        status: true,
        createdAt: true,
        role: { select: { id: true, name: true, code: true } },
        locations: { include: { location: true } },
      },
    })
    await audit(transaction, tenantId, actorUserId, 'TENANT_USER', 'UPDATE', id)
    return user
  })
}

export function listRoles(tenantId: string) {
  return prisma.tenantRole.findMany({
    where: { tenantId, deletedAt: null },
    orderBy: [{ isSystemRole: 'desc' }, { name: 'asc' }],
    include: {
      permissions: {
        include: { permission: true },
      },
      _count: { select: { users: true } },
    },
  })
}

export function listPermissions() {
  return prisma.permission.findMany({
    orderBy: [{ module: 'asc' }, { action: 'asc' }],
    include: { _count: { select: { roles: true } } },
  })
}

export function findPermissions(ids: string[]) {
  return prisma.permission.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  })
}

export function createRole(
  tenantId: string,
  data: Omit<Prisma.TenantRoleUncheckedCreateInput, 'tenantId'>,
  permissionIds: string[],
  actorUserId: string,
) {
  return prisma.$transaction(async (transaction) => {
    const role = await transaction.tenantRole.create({
      data: { ...data, tenantId },
    })
    await transaction.tenantRolePermission.createMany({
      data: permissionIds.map((permissionId) => ({
        tenantId,
        roleId: role.id,
        permissionId,
        createdById: actorUserId,
      })),
    })
    await audit(
      transaction,
      tenantId,
      actorUserId,
      'TENANT_ROLE',
      'CREATE',
      role.id,
    )
    return transaction.tenantRole.findUniqueOrThrow({
      where: { id: role.id },
      include: { permissions: { include: { permission: true } } },
    })
  })
}

export function updateRole(
  tenantId: string,
  id: string,
  data: Prisma.TenantRoleUncheckedUpdateInput,
  actorUserId: string,
) {
  return prisma.$transaction(async (transaction) => {
    const role = await transaction.tenantRole.findUnique({
      where: { tenantId_id: { tenantId, id } },
    })
    if (!role || role.deletedAt) return null
    const updated = await transaction.tenantRole.update({
      where: { id },
      data,
      include: { permissions: { include: { permission: true } } },
    })
    await audit(transaction, tenantId, actorUserId, 'TENANT_ROLE', 'UPDATE', id)
    return updated
  })
}

export function replaceRolePermissions(
  tenantId: string,
  roleId: string,
  permissionIds: string[],
  actorUserId: string,
) {
  return prisma.$transaction(async (transaction) => {
    const role = await transaction.tenantRole.findUnique({
      where: { tenantId_id: { tenantId, id: roleId } },
    })
    if (!role || role.deletedAt) return null
    await transaction.tenantRolePermission.deleteMany({
      where: { tenantId, roleId },
    })
    await transaction.tenantRolePermission.createMany({
      data: permissionIds.map((permissionId) => ({
        tenantId,
        roleId,
        permissionId,
        createdById: actorUserId,
      })),
    })
    await audit(
      transaction,
      tenantId,
      actorUserId,
      'TENANT_ROLE',
      'UPDATE_PERMISSIONS',
      roleId,
    )
    return transaction.tenantRole.findUnique({
      where: { tenantId_id: { tenantId, id: roleId } },
      include: { permissions: { include: { permission: true } } },
    })
  })
}
