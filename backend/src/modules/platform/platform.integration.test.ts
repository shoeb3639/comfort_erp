import request from 'supertest'
import { app } from '../../app'
import { prisma } from '../../config/prisma'
import { PLATFORM_PERMISSIONS } from '../auth/auth.constants'
import { hashPassword } from '../../shared/security/password'

const password = 'Platform-Api!9Qv7#Secure'
let accessToken: string
let tenantId: string
let planId: string
let subscriptionId: string
let ownerId: string

async function cleanDatabase() {
  await prisma.booking.deleteMany()
  await prisma.vehicle.deleteMany()
  await prisma.vehicleType.deleteMany()
  await prisma.driver.deleteMany()
  await prisma.vendor.deleteMany()
  await prisma.customer.deleteMany()
  await prisma.tenantAuditLog.deleteMany()
  await prisma.tenantOnboardingItem.deleteMany()
  await prisma.tenantRefreshToken.deleteMany()
  await prisma.tenantRolePermission.deleteMany()
  await prisma.tenantUser.deleteMany()
  await prisma.tenantRole.deleteMany()
  await prisma.subscriptionPayment.deleteMany()
  await prisma.tenantSubscription.deleteMany()
  await prisma.tenant.deleteMany()
  await prisma.permission.deleteMany()
  await prisma.platformAuditLog.deleteMany()
  await prisma.platformRefreshToken.deleteMany()
  await prisma.platformRolePermission.deleteMany()
  await prisma.platformUser.deleteMany()
  await prisma.platformRole.deleteMany()
  await prisma.platformPermission.deleteMany()
  await prisma.subscriptionPlan.deleteMany()
}

beforeAll(async () => {
  await cleanDatabase()
  const permissions = await Promise.all(
    PLATFORM_PERMISSIONS.map(([module, action]) =>
      prisma.platformPermission.create({
        data: { module, action, permissionKey: `${module}.${action}` },
      }),
    ),
  )
  const role = await prisma.platformRole.create({
    data: {
      name: 'Platform API Admin',
      code: 'PLATFORM_API_ADMIN',
      status: 'ACTIVE',
    },
  })
  await prisma.platformRolePermission.createMany({
    data: permissions.map((permission) => ({
      roleId: role.id,
      permissionId: permission.id,
    })),
  })
  await prisma.platformUser.create({
    data: {
      name: 'Platform API Admin',
      email: 'platform-api@example.com',
      passwordHash: await hashPassword(password),
      roleId: role.id,
      status: 'ACTIVE',
    },
  })
  const tenant = await prisma.tenant.create({
    data: {
      code: 'LIFECYCLE',
      legalName: 'Lifecycle Cabs',
      email: 'office@lifecycle.example.com',
      mobile: '9999999999',
      status: 'PENDING_SETUP',
    },
  })
  tenantId = tenant.id
  await prisma.tenantRole.create({
    data: {
      tenantId,
      name: 'Super Admin',
      code: 'SUPER_ADMIN',
      isSystemRole: true,
      status: 'ACTIVE',
    },
  })
  const login = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'platform-api@example.com', password })
  accessToken = login.body.data.accessToken as string
})

afterAll(async () => {
  await cleanDatabase()
  await prisma.$disconnect()
})

function authorized(method: 'get' | 'post' | 'patch' | 'delete', path: string) {
  return request(app)
    [method](path)
    .set('Authorization', `Bearer ${accessToken}`)
}

describe('platform phase-one APIs', () => {
  it('creates, updates, lists, and safely deactivates subscription plans', async () => {
    const created = await authorized(
      'post',
      '/api/v1/platform/subscription-plans',
    ).send({
      code: 'API_GROWTH',
      name: 'API Growth',
      billingCycle: 'MONTHLY',
      basePrice: 2500,
      validityDays: 30,
      userLimit: 10,
      vehicleLimit: 50,
      bookingLimit: 2000,
      trialDays: 14,
    })
    expect(created.status).toBe(201)
    planId = created.body.data.id as string

    const updated = await authorized(
      'patch',
      `/api/v1/platform/subscription-plans/${planId}`,
    ).send({ basePrice: 2750, name: 'API Growth Plus' })
    expect(updated.status).toBe(200)
    expect(Number(updated.body.data.basePrice)).toBe(2750)

    const listed = await authorized(
      'get',
      '/api/v1/platform/subscription-plans',
    )
    expect(listed.status).toBe(200)
    expect(listed.body.data).toHaveLength(1)

    const deactivated = await authorized(
      'delete',
      `/api/v1/platform/subscription-plans/${planId}`,
    )
    expect(deactivated.status).toBe(200)
    expect(deactivated.body.data.isActive).toBe(false)

    await authorized(
      'patch',
      `/api/v1/platform/subscription-plans/${planId}`,
    ).send({ isActive: true })
  })

  it('creates and manages a tenant subscription with lifecycle validation', async () => {
    const startsAt = new Date()
    const expiresAt = new Date(startsAt.getTime() + 30 * 86400000)
    const created = await authorized(
      'post',
      '/api/v1/platform/tenant-subscriptions',
    ).send({
      tenantId,
      planId,
      status: 'ACTIVE',
      startsAt: startsAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      amount: 2750,
      discountAmount: 250,
      taxAmount: 450,
      finalAmount: 2950,
      paymentStatus: 'PAID',
    })
    expect(created.status).toBe(201)
    subscriptionId = created.body.data.id as string

    const duplicate = await authorized(
      'post',
      '/api/v1/platform/tenant-subscriptions',
    ).send({
      tenantId,
      planId,
      status: 'ACTIVE',
      startsAt: startsAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
    })
    expect(duplicate.status).toBe(409)
    expect(duplicate.body.code).toBe('CURRENT_SUBSCRIPTION_EXISTS')

    const suspended = await authorized(
      'patch',
      `/api/v1/platform/tenant-subscriptions/${subscriptionId}`,
    ).send({ status: 'SUSPENDED' })
    expect(suspended.status).toBe(200)
    const invalid = await authorized(
      'patch',
      `/api/v1/platform/tenant-subscriptions/${subscriptionId}`,
    ).send({ status: 'TRIAL' })
    expect(invalid.status).toBe(409)
    expect(invalid.body.code).toBe('INVALID_STATUS_TRANSITION')
    const activated = await authorized(
      'patch',
      `/api/v1/platform/tenant-subscriptions/${subscriptionId}`,
    ).send({ status: 'ACTIVE' })
    expect(activated.status).toBe(200)

    const listed = await authorized(
      'get',
      `/api/v1/platform/tenant-subscriptions?tenantId=${tenantId}`,
    )
    expect(listed.status).toBe(200)
    expect(listed.body.data.items).toHaveLength(1)
  })

  it('creates the missing primary owner and prevents a second primary owner', async () => {
    const body = {
      name: 'Lifecycle Owner',
      email: 'owner@lifecycle.example.com',
      mobile: '9999999998',
      password: 'Tenant-Owner!8Pq4#Secure',
      status: 'ACTIVE',
    }
    const created = await authorized(
      'post',
      `/api/v1/platform/tenants/${tenantId}/owners`,
    ).send(body)
    expect(created.status).toBe(201)
    ownerId = created.body.data.id as string
    expect(created.body.data.isPrimaryOwner).toBe(true)
    expect(created.body.data).not.toHaveProperty('passwordHash')

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: body.email, password: body.password })
    expect(login.status).toBe(200)
    expect(login.body.data.user.userType).toBe('TENANT')

    const duplicate = await authorized(
      'post',
      `/api/v1/platform/tenants/${tenantId}/owners`,
    ).send({ ...body, email: 'second@lifecycle.example.com' })
    expect(duplicate.status).toBe(409)
    expect(duplicate.body.code).toBe('PRIMARY_OWNER_EXISTS')
  })

  it('updates tenant and primary-owner details and exposes audit activity', async () => {
    const tenantUpdate = await authorized(
      'patch',
      `/api/v1/platform/tenants/${tenantId}`,
    ).send({
      tradeName: 'Lifecycle Mobility',
      email: 'admin@lifecycle.example.com',
      mobile: '9888888888',
      city: 'New Delhi',
    })
    expect(tenantUpdate.status).toBe(200)
    expect(tenantUpdate.body.data.tradeName).toBe('Lifecycle Mobility')

    const ownerUpdate = await authorized(
      'patch',
      `/api/v1/platform/tenants/${tenantId}/owners/${ownerId}`,
    ).send({
      name: 'Updated Lifecycle Owner',
      designation: 'Managing Director',
      mobile: '9777777777',
    })
    expect(ownerUpdate.status).toBe(200)
    expect(ownerUpdate.body.data.name).toBe('Updated Lifecycle Owner')

    const audit = await authorized('get', '/api/v1/platform/audit-logs')
    expect(audit.status).toBe(200)
    const auditRecords = audit.body.data as Array<{
      module: string
      referenceId: string
    }>
    expect(
      auditRecords.some(
        (item) => item.module === 'TENANT' && item.referenceId === tenantId,
      ),
    ).toBe(true)
  })

  it('activates and suspends a tenant without deleting its data', async () => {
    const activated = await authorized(
      'patch',
      `/api/v1/platform/tenants/${tenantId}/status`,
    ).send({ status: 'ACTIVE', reason: 'Onboarding verified' })
    expect(activated.status).toBe(200)
    const suspended = await authorized(
      'patch',
      `/api/v1/platform/tenants/${tenantId}/status`,
    ).send({ status: 'SUSPENDED', reason: 'Administrative review' })
    expect(suspended.status).toBe(200)
    expect(suspended.body.data.status).toBe('SUSPENDED')
    await expect(
      prisma.tenantUser.count({ where: { tenantId } }),
    ).resolves.toBe(1)
    await expect(
      prisma.platformAuditLog.count({
        where: {
          module: 'TENANT',
          referenceId: tenantId,
          action: { in: ['ACTIVATE', 'SUSPEND'] },
        },
      }),
    ).resolves.toBe(2)
  })
})
