import request from 'supertest'
import { app } from '../../app'
import { prisma } from '../../config/prisma'
import {
  PLATFORM_PERMISSIONS,
  TENANT_PERMISSIONS,
} from '../auth/auth.constants'
import { hashPassword } from '../../shared/security/password'
import { TENANT_ONBOARDING_ITEMS } from './tenant-registration.constants'

const platformPassword = 'Registration-Test!9Qv7#Secure'
let planId: string
let accessToken: string

async function cleanDatabase(): Promise<void> {
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

function registrationPayload(code = 'ACME_CABS') {
  const startsAt = new Date()
  const expiresAt = new Date(startsAt)
  expiresAt.setFullYear(expiresAt.getFullYear() + 1)

  return {
    tenant: {
      code,
      legalName: 'Acme Cabs Private Limited',
      tradeName: 'Acme Cabs',
      email: 'office@acme.example.com',
      mobile: '9999999999',
      city: 'Bengaluru',
      state: 'Karnataka',
      pinCode: '560001',
    },
    owner: {
      name: 'Acme Owner',
      email: 'owner@acme.example.com',
      mobile: '9999999998',
      designation: 'Owner',
      password: 'Acme-Owner!8Pq4#Secure',
    },
    subscription: {
      planId,
      status: 'ACTIVE',
      startsAt: startsAt.toISOString(),
      expiresAt: expiresAt.toISOString(),
      discountAmount: 10,
      taxAmount: 18,
      finalAmount: 108,
      paymentStatus: 'PAID',
    },
  }
}

beforeAll(async () => {
  await cleanDatabase()

  const platformPermissions = await Promise.all(
    PLATFORM_PERMISSIONS.map(([module, action]) =>
      prisma.platformPermission.create({
        data: { module, action, permissionKey: `${module}.${action}` },
      }),
    ),
  )
  const role = await prisma.platformRole.create({
    data: {
      name: 'Registration Admin',
      code: 'REGISTRATION_ADMIN',
      status: 'ACTIVE',
    },
  })
  await prisma.platformRolePermission.createMany({
    data: platformPermissions.map((permission) => ({
      roleId: role.id,
      permissionId: permission.id,
    })),
  })
  await prisma.platformUser.create({
    data: {
      name: 'Registration Admin',
      email: 'registration-admin@example.com',
      passwordHash: await hashPassword(platformPassword),
      roleId: role.id,
      status: 'ACTIVE',
    },
  })
  await prisma.permission.createMany({
    data: TENANT_PERMISSIONS.map(([module, action]) => ({
      module,
      action,
      permissionKey: `${module}.${action}`,
    })),
  })
  const plan = await prisma.subscriptionPlan.create({
    data: {
      code: 'ANNUAL_TEST',
      name: 'Annual Test Plan',
      billingCycle: 'ANNUAL',
      basePrice: 100,
      userLimit: 10,
      vehicleLimit: 25,
      bookingLimit: 500,
      storageLimitMb: 2048,
      isActive: true,
    },
  })
  planId = plan.id

  const loginResponse = await request(app).post('/api/v1/auth/login').send({
    email: 'registration-admin@example.com',
    password: platformPassword,
  })
  accessToken = loginResponse.body.data.accessToken as string
})

afterAll(async () => {
  await cleanDatabase()
  await prisma.$disconnect()
})

describe('tenant registration', () => {
  it('atomically creates the tenant, subscription, owner, roles, checklist, and audit log', async () => {
    const response = await request(app)
      .post('/api/v1/platform/tenants')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(registrationPayload())

    expect(response.status).toBe(201)
    expect(response.body.data.tenant.code).toBe('ACME_CABS')
    expect(response.body.data.owner).not.toHaveProperty('passwordHash')
    expect(response.body.data.owner.isPrimaryOwner).toBe(true)
    expect(response.body.data.subscription.plan.code).toBe('ANNUAL_TEST')
    expect(response.body.data.subscription.billingCycle).toBe('ANNUAL')
    expect(response.body.data.subscription.userLimit).toBe(10)

    const tenantId = response.body.data.tenant.id as string
    const [roles, owner, checklist, auditLog] = await Promise.all([
      prisma.tenantRole.findMany({ where: { tenantId } }),
      prisma.tenantUser.findFirstOrThrow({
        where: { tenantId, isPrimaryOwner: true },
      }),
      prisma.tenantOnboardingItem.findMany({ where: { tenantId } }),
      prisma.platformAuditLog.findFirst({
        where: { referenceId: tenantId, action: 'CREATE' },
      }),
    ])
    expect(roles).toHaveLength(7)
    expect(owner.status).toBe('ACTIVE')
    expect(checklist).toHaveLength(TENANT_ONBOARDING_ITEMS.length)
    expect(auditLog).not.toBeNull()

    const ownerLogin = await request(app).post('/api/v1/auth/login').send({
      email: 'owner@acme.example.com',
      password: 'Acme-Owner!8Pq4#Secure',
    })
    expect(ownerLogin.status).toBe(200)
    expect(ownerLogin.body.data.user.userType).toBe('TENANT')
    expect(ownerLogin.body.data.user.tenantId).toBe(tenantId)

    const pendingAccess = await request(app)
      .get('/api/v1/tenant/access')
      .set('Authorization', `Bearer ${ownerLogin.body.data.accessToken}`)
    expect(pendingAccess.status).toBe(403)
    expect(pendingAccess.body.code).toBe('TENANT_INACTIVE')

    const activation = await request(app)
      .patch(`/api/v1/platform/tenants/${tenantId}/status`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ status: 'ACTIVE', reason: 'Registration verified' })
    expect(activation.status).toBe(200)

    const tenantContext = await request(app)
      .get('/api/v1/tenant/access')
      .set('Authorization', `Bearer ${ownerLogin.body.data.accessToken}`)
    expect(tenantContext.status).toBe(200)
    expect(tenantContext.body.data.tenant.id).toBe(tenantId)

    const tenantList = await request(app)
      .get('/api/v1/platform/tenants')
      .set('Authorization', `Bearer ${accessToken}`)
    expect(tenantList.status).toBe(200)
    expect(tenantList.body.data.items[0].code).toBe('ACME_CABS')
    expect(tenantList.body.data.items[0].users[0].email).toBe(
      'owner@acme.example.com',
    )

    const tenantDetail = await request(app)
      .get(`/api/v1/platform/tenants/${tenantId}`)
      .set('Authorization', `Bearer ${accessToken}`)
    expect(tenantDetail.status).toBe(200)
    expect(tenantDetail.body.data.users[0].email).toBe('owner@acme.example.com')
    expect(tenantDetail.body.data.roles).toHaveLength(7)
    expect(tenantDetail.body.data.onboardingItems).toHaveLength(
      TENANT_ONBOARDING_ITEMS.length,
    )

    const planList = await request(app)
      .get('/api/v1/platform/subscription-plans')
      .set('Authorization', `Bearer ${accessToken}`)
    expect(planList.status).toBe(200)
    expect(planList.body.data[0].id).toBe(planId)
  })

  it('rejects a duplicate code without creating partial onboarding records', async () => {
    const countsBefore = await Promise.all([
      prisma.tenant.count(),
      prisma.tenantUser.count(),
      prisma.tenantSubscription.count(),
      prisma.tenantRole.count(),
    ])

    const response = await request(app)
      .post('/api/v1/platform/tenants')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(registrationPayload())

    expect(response.status).toBe(409)
    expect(response.body.code).toBe('CONFLICT')
    await expect(
      Promise.all([
        prisma.tenant.count(),
        prisma.tenantUser.count(),
        prisma.tenantSubscription.count(),
        prisma.tenantRole.count(),
      ]),
    ).resolves.toEqual(countsBefore)
  })

  it('rejects invalid subscription totals before creating a tenant', async () => {
    const payload = registrationPayload('BAD_TOTAL')
    payload.subscription.finalAmount = 999

    const response = await request(app)
      .post('/api/v1/platform/tenants')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(payload)

    expect(response.status).toBe(400)
    expect(response.body.code).toBe('VALIDATION_ERROR')
    await expect(
      prisma.tenant.count({ where: { code: 'BAD_TOTAL' } }),
    ).resolves.toBe(0)
  })

  it('requires an authenticated platform user with tenant.create permission', async () => {
    const response = await request(app)
      .post('/api/v1/platform/tenants')
      .send(registrationPayload('UNAUTHORIZED'))

    expect(response.status).toBe(401)
    await expect(
      prisma.tenant.count({ where: { code: 'UNAUTHORIZED' } }),
    ).resolves.toBe(0)
  })
})
