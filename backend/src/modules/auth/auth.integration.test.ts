import express, { type RequestHandler } from 'express'
import request from 'supertest'
import { app } from '../../app'
import { prisma } from '../../config/prisma'
import { authenticateUser } from '../../middlewares/authenticate-user.middleware'
import { authorizePermission } from '../../middlewares/authorize-permission.middleware'
import { checkSubscription } from '../../middlewares/check-subscription.middleware'
import { checkTenantStatus } from '../../middlewares/check-tenant-status.middleware'
import { errorHandler } from '../../middlewares/error-handler.middleware'
import { resolveTenant } from '../../middlewares/resolve-tenant.middleware'
import { hashPassword } from '../../shared/security/password'
import { signAccessToken } from '../../shared/security/tokens'

const password = 'Integration-Test!9Qv7#Secure'

interface Fixtures {
  tenantAId: string
  tenantBId: string
  suspendedTenantId: string
  expiredTenantId: string
  tenantAUserId: string
  suspendedUserId: string
  suspendedRoleId: string
  expiredUserId: string
  expiredRoleId: string
}

let fixtures: Fixtures

async function cleanDatabase(): Promise<void> {
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

async function createTenantFixture(input: {
  code: string
  email: string
  tenantStatus?: 'ACTIVE' | 'SUSPENDED'
  subscriptionStatus?: 'ACTIVE' | 'EXPIRED'
  withPermission?: boolean
}) {
  const tenant = await prisma.tenant.create({
    data: {
      code: input.code,
      legalName: `${input.code} Legal Name`,
      email: `${input.code.toLowerCase()}@example.com`,
      mobile: '9999999999',
      status: input.tenantStatus ?? 'ACTIVE',
      onboardingStatus: 'COMPLETED',
    },
  })
  const role = await prisma.tenantRole.create({
    data: {
      tenantId: tenant.id,
      name: 'Test Role',
      code: `TEST_${input.code}`,
      status: 'ACTIVE',
    },
  })
  if (input.withPermission !== false) {
    const permission = await prisma.permission.findUniqueOrThrow({
      where: { permissionKey: 'user.profile.view' },
    })
    await prisma.tenantRolePermission.create({
      data: {
        tenantId: tenant.id,
        roleId: role.id,
        permissionId: permission.id,
      },
    })
  }
  const user = await prisma.tenantUser.create({
    data: {
      tenantId: tenant.id,
      roleId: role.id,
      name: `${input.code} User`,
      email: input.email,
      passwordHash: await hashPassword(password),
      status: 'ACTIVE',
    },
  })
  const plan = await prisma.subscriptionPlan.findUniqueOrThrow({
    where: { code: 'TEST_PLAN' },
  })
  const active = input.subscriptionStatus !== 'EXPIRED'
  await prisma.tenantSubscription.create({
    data: {
      tenantId: tenant.id,
      planId: plan.id,
      status: active ? 'ACTIVE' : 'EXPIRED',
      billingCycle: 'MONTHLY',
      startsAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      expiresAt: new Date(
        Date.now() + (active ? 30 : -1) * 24 * 60 * 60 * 1000,
      ),
      amount: 100,
      finalAmount: 100,
      paymentStatus: 'PAID',
    },
  })
  return { tenant, role, user }
}

async function login(email: string) {
  return request(app).post('/api/v1/auth/login').send({ email, password })
}

function writeTestApp(): express.Express {
  const testApp = express()
  testApp.use(express.json())
  const success: RequestHandler = (_request, response) => {
    response.status(200).json({ success: true })
  }
  testApp.post(
    '/write',
    authenticateUser,
    resolveTenant,
    checkTenantStatus,
    checkSubscription(),
    authorizePermission('user.profile.view'),
    success,
  )
  testApp.use(errorHandler)
  return testApp
}

beforeAll(async () => {
  await cleanDatabase()
  const passwordHash = await hashPassword(password)
  const platformPermission = await prisma.platformPermission.create({
    data: {
      module: 'platform.dashboard',
      action: 'view',
      permissionKey: 'platform.dashboard.view',
    },
  })
  const platformRole = await prisma.platformRole.create({
    data: {
      name: 'Test Platform Role',
      code: 'TEST_PLATFORM',
      status: 'ACTIVE',
    },
  })
  await prisma.platformRolePermission.create({
    data: { roleId: platformRole.id, permissionId: platformPermission.id },
  })
  await prisma.platformUser.create({
    data: {
      name: 'Platform Test User',
      email: 'platform@example.com',
      passwordHash,
      roleId: platformRole.id,
      status: 'ACTIVE',
    },
  })
  await prisma.permission.create({
    data: {
      module: 'user.profile',
      action: 'view',
      permissionKey: 'user.profile.view',
    },
  })
  await prisma.subscriptionPlan.create({
    data: {
      code: 'TEST_PLAN',
      name: 'Test Plan',
      billingCycle: 'MONTHLY',
      basePrice: 100,
      isActive: true,
    },
  })

  const tenantA = await createTenantFixture({
    code: 'TENANT_A',
    email: 'tenant-a-user@example.com',
  })
  const tenantB = await createTenantFixture({
    code: 'TENANT_B',
    email: 'tenant-b-user@example.com',
  })
  await createTenantFixture({
    code: 'NO_PERMISSION',
    email: 'no-permission@example.com',
    withPermission: false,
  })
  const suspended = await createTenantFixture({
    code: 'SUSPENDED',
    email: 'suspended@example.com',
    tenantStatus: 'SUSPENDED',
  })
  const expired = await createTenantFixture({
    code: 'EXPIRED',
    email: 'expired@example.com',
    subscriptionStatus: 'EXPIRED',
  })

  fixtures = {
    tenantAId: tenantA.tenant.id,
    tenantBId: tenantB.tenant.id,
    suspendedTenantId: suspended.tenant.id,
    expiredTenantId: expired.tenant.id,
    tenantAUserId: tenantA.user.id,
    suspendedUserId: suspended.user.id,
    suspendedRoleId: suspended.role.id,
    expiredUserId: expired.user.id,
    expiredRoleId: expired.role.id,
  }
})

afterAll(async () => {
  await cleanDatabase()
  await prisma.$disconnect()
})

describe('authentication and authorization', () => {
  it('logs in a platform user and permits only platform scope', async () => {
    const response = await login('platform@example.com')
    expect(response.status).toBe(200)
    expect(response.body.data.user.userType).toBe('PLATFORM')

    const platformResponse = await request(app)
      .get('/api/v1/platform/me')
      .set('Authorization', `Bearer ${response.body.data.accessToken}`)
    expect(platformResponse.status).toBe(200)

    const tenantResponse = await request(app)
      .get('/api/v1/tenant/me')
      .set('Authorization', `Bearer ${response.body.data.accessToken}`)
    expect(tenantResponse.status).toBe(403)
  })

  it('derives tenant context only from the verified token', async () => {
    const response = await login('tenant-a-user@example.com')
    const contextResponse = await request(app)
      .get(`/api/v1/tenant/me?tenant_id=${fixtures.tenantBId}`)
      .set('X-Tenant-Id', fixtures.tenantBId)
      .set('Authorization', `Bearer ${response.body.data.accessToken}`)

    expect(contextResponse.status).toBe(200)
    expect(contextResponse.body.data.tenant.id).toBe(fixtures.tenantAId)
    expect(contextResponse.body.data.auth.tenantId).toBe(fixtures.tenantAId)
  })

  it('prevents tenant users from accessing platform APIs', async () => {
    const response = await login('tenant-b-user@example.com')
    const protectedResponse = await request(app)
      .get('/api/v1/platform/me')
      .set('Authorization', `Bearer ${response.body.data.accessToken}`)

    expect(protectedResponse.status).toBe(403)
    expect(protectedResponse.body.code).toBe('FORBIDDEN')
  })

  it('denies endpoints when the required permission is absent', async () => {
    const response = await login('no-permission@example.com')
    const protectedResponse = await request(app)
      .get('/api/v1/tenant/me')
      .set('Authorization', `Bearer ${response.body.data.accessToken}`)

    expect(protectedResponse.status).toBe(403)
    expect(protectedResponse.body.code).toBe('FORBIDDEN')
  })

  it('rotates refresh tokens and rejects replay', async () => {
    const response = await login('tenant-a-user@example.com')
    const currentRefreshToken = response.body.data.refreshToken as string
    const refreshResponse = await request(app)
      .post('/api/v1/auth/refresh-token')
      .send({ refreshToken: currentRefreshToken })

    expect(refreshResponse.status).toBe(200)
    expect(refreshResponse.body.data.refreshToken).not.toBe(currentRefreshToken)

    const replayResponse = await request(app)
      .post('/api/v1/auth/refresh-token')
      .send({ refreshToken: currentRefreshToken })
    expect(replayResponse.status).toBe(401)
  })

  it('revokes a refresh token on logout', async () => {
    const response = await login('tenant-b-user@example.com')
    const refreshToken = response.body.data.refreshToken as string

    expect(
      (await request(app).post('/api/v1/auth/logout').send({ refreshToken }))
        .status,
    ).toBe(200)
    expect(
      (
        await request(app)
          .post('/api/v1/auth/refresh-token')
          .send({ refreshToken })
      ).status,
    ).toBe(401)
  })

  it('blocks writes for suspended tenants', async () => {
    const token = signAccessToken({
      userId: fixtures.suspendedUserId,
      userType: 'TENANT',
      tenantId: fixtures.suspendedTenantId,
      roleId: fixtures.suspendedRoleId,
      permissions: ['user.profile.view'],
    })
    const response = await request(writeTestApp())
      .post('/write')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(403)
    expect(response.body.code).toBe('TENANT_SUSPENDED')
  })

  it('blocks writes for expired subscriptions', async () => {
    const token = signAccessToken({
      userId: fixtures.expiredUserId,
      userType: 'TENANT',
      tenantId: fixtures.expiredTenantId,
      roleId: fixtures.expiredRoleId,
      permissions: ['user.profile.view'],
    })
    const response = await request(writeTestApp())
      .post('/write')
      .set('Authorization', `Bearer ${token}`)

    expect(response.status).toBe(403)
    expect(response.body.code).toBe('SUBSCRIPTION_EXPIRED')
  })

  it('rejects a cross-tenant user relationship at the database boundary', async () => {
    await expect(
      prisma.tenantRefreshToken.create({
        data: {
          tenantId: fixtures.tenantBId,
          userId: fixtures.tenantAUserId,
          tokenHash: 'cross-tenant-token-hash',
          expiresAt: new Date(Date.now() + 60_000),
        },
      }),
    ).rejects.toThrow()
  })
})
