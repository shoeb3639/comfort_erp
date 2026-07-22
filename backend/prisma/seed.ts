import Joi from 'joi'
import { prisma } from '../src/config/prisma'
import {
  PLATFORM_PERMISSIONS,
  TENANT_PERMISSIONS,
  TENANT_SYSTEM_ROLES,
} from '../src/modules/auth/auth.constants'
import { hashPassword } from '../src/shared/security/password'

const adminSchema = Joi.object({
  PLATFORM_ADMIN_NAME: Joi.string().min(2).max(150).required(),
  PLATFORM_ADMIN_EMAIL: Joi.string().email().required(),
  PLATFORM_ADMIN_PASSWORD: Joi.string().min(14).max(128).required(),
}).unknown(true)

async function seedPlatformSecurity(): Promise<void> {
  const permissionRecords = await Promise.all(
    PLATFORM_PERMISSIONS.map(([module, action]) =>
      prisma.platformPermission.upsert({
        where: { permissionKey: `${module}.${action}` },
        create: {
          module,
          action,
          permissionKey: `${module}.${action}`,
        },
        update: { module, action },
      }),
    ),
  )

  const role = await prisma.platformRole.upsert({
    where: { code: 'PLATFORM_SUPER_ADMIN' },
    create: {
      name: 'Platform Super Admin',
      code: 'PLATFORM_SUPER_ADMIN',
      description: 'Full Cablix SaaS platform administration access.',
      isSystemRole: true,
      status: 'ACTIVE',
    },
    update: { status: 'ACTIVE' },
  })

  await prisma.platformRolePermission.createMany({
    data: permissionRecords.map((permission) => ({
      roleId: role.id,
      permissionId: permission.id,
    })),
    skipDuplicates: true,
  })

  const result = adminSchema.validate(process.env, { abortEarly: false })
  if (result.error) {
    throw new Error(
      `Initial platform administrator configuration is invalid: ${result.error.message}`,
    )
  }

  const adminName = result.value.PLATFORM_ADMIN_NAME as string
  const adminEmail = (result.value.PLATFORM_ADMIN_EMAIL as string).toLowerCase()
  const adminPassword = result.value.PLATFORM_ADMIN_PASSWORD as string
  const existingAdmin = await prisma.platformUser.findUnique({
    where: { email: adminEmail },
    select: { id: true },
  })

  if (!existingAdmin) {
    await prisma.platformUser.create({
      data: {
        name: adminName,
        email: adminEmail,
        passwordHash: await hashPassword(adminPassword),
        roleId: role.id,
        status: 'ACTIVE',
      },
    })
  }
}

async function seedTenantSecurity(): Promise<void> {
  const permissions = await Promise.all(
    TENANT_PERMISSIONS.map(([module, action]) =>
      prisma.permission.upsert({
        where: { permissionKey: `${module}.${action}` },
        create: {
          module,
          action,
          permissionKey: `${module}.${action}`,
        },
        update: { module, action },
      }),
    ),
  )
  const permissionByKey = new Map(
    permissions.map((permission) => [permission.permissionKey, permission.id]),
  )
  const tenants = await prisma.tenant.findMany({ select: { id: true } })

  for (const tenant of tenants) {
    for (const roleDefinition of TENANT_SYSTEM_ROLES) {
      const role = await prisma.tenantRole.upsert({
        where: {
          tenantId_code: {
            tenantId: tenant.id,
            code: roleDefinition.code,
          },
        },
        create: {
          tenantId: tenant.id,
          name: roleDefinition.name,
          code: roleDefinition.code,
          isSystemRole: true,
          status: 'ACTIVE',
        },
        update: { name: roleDefinition.name, status: 'ACTIVE' },
      })

      await prisma.tenantRolePermission.createMany({
        data: roleDefinition.permissions.map((permissionKey) => ({
          tenantId: tenant.id,
          roleId: role.id,
          permissionId: permissionByKey.get(permissionKey)!,
        })),
        skipDuplicates: true,
      })
    }
  }
}

async function main(): Promise<void> {
  await seedPlatformSecurity()
  await seedTenantSecurity()
}

void main()
  .then(() => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(
      error instanceof Error ? error.message : 'Database seed failed',
    )
    await prisma.$disconnect()
    process.exitCode = 1
  })
