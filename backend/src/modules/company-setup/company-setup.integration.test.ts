import request from 'supertest'
import { app } from '../../app'
import { prisma } from '../../config/prisma'
import { hashPassword } from '../../shared/security/password'
import { TENANT_PERMISSIONS } from '../auth/auth.constants'
import { TENANT_ONBOARDING_ITEMS } from '../tenants/tenant-registration.constants'

const ownerPassword = 'Company-Setup!9Qv7#Secure'
let accessToken: string
let tenantId: string
let ownerRoleId: string

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
  await prisma.tenantUserLocation.deleteMany()
  await prisma.gstRegistrationLocation.deleteMany()
  await prisma.gstRegistration.deleteMany()
  await prisma.tenantBankAccount.deleteMany()
  await prisma.tenantLocation.deleteMany()
  await prisma.tenantRolePermission.deleteMany()
  await prisma.tenantUser.deleteMany()
  await prisma.tenantRole.deleteMany()
  await prisma.subscriptionPayment.deleteMany()
  await prisma.tenantSubscription.deleteMany()
  await prisma.tenant.deleteMany()
  await prisma.permission.deleteMany()
  await prisma.subscriptionPlan.deleteMany()
}

beforeAll(async () => {
  await cleanDatabase()

  const permissions = await Promise.all(
    TENANT_PERMISSIONS.map(([module, action]) =>
      prisma.permission.create({
        data: { module, action, permissionKey: `${module}.${action}` },
      }),
    ),
  )
  const tenant = await prisma.tenant.create({
    data: {
      code: 'PHASE3_TEST',
      legalName: 'Phase 3 Test Private Limited',
      email: 'office@phase3.example.com',
      mobile: '9999999999',
      status: 'ACTIVE',
      onboardingItems: { create: TENANT_ONBOARDING_ITEMS },
    },
  })
  tenantId = tenant.id
  const ownerRole = await prisma.tenantRole.create({
    data: {
      tenantId,
      name: 'Super Admin',
      code: 'SUPER_ADMIN',
      isSystemRole: true,
      status: 'ACTIVE',
    },
  })
  ownerRoleId = ownerRole.id
  await prisma.tenantRolePermission.createMany({
    data: permissions.map((permission) => ({
      tenantId,
      roleId: ownerRole.id,
      permissionId: permission.id,
    })),
  })
  await prisma.tenantUser.create({
    data: {
      tenantId,
      roleId: ownerRole.id,
      name: 'Phase 3 Owner',
      email: 'owner@phase3.example.com',
      passwordHash: await hashPassword(ownerPassword),
      isPrimaryOwner: true,
      status: 'ACTIVE',
    },
  })
  const plan = await prisma.subscriptionPlan.create({
    data: {
      code: 'PHASE3_PLAN',
      name: 'Phase 3 Plan',
      billingCycle: 'ANNUAL',
      basePrice: 1000,
      userLimit: 10,
    },
  })
  await prisma.tenantSubscription.create({
    data: {
      tenantId,
      planId: plan.id,
      status: 'ACTIVE',
      billingCycle: 'ANNUAL',
      startsAt: new Date(Date.now() - 86_400_000),
      expiresAt: new Date(Date.now() + 365 * 86_400_000),
      userLimit: 10,
      amount: 1000,
      finalAmount: 1000,
      paymentStatus: 'PAID',
    },
  })

  const login = await request(app).post('/api/v1/auth/login').send({
    email: 'owner@phase3.example.com',
    password: ownerPassword,
  })
  expect(login.status).toBe(200)
  accessToken = login.body.data.accessToken as string
})

afterAll(async () => {
  await cleanDatabase()
  await prisma.$disconnect()
})

function tenantRequest(method: 'get' | 'post' | 'patch', path: string) {
  return request(app)
    [method](`/api/v1/tenant/setup${path}`)
    .set('Authorization', `Bearer ${accessToken}`)
}

describe('company setup APIs', () => {
  it('persists the profile, tax, invoice, location, bank, and GST setup and completes onboarding', async () => {
    const profile = await tenantRequest('patch', '/company-profile').send({
      tradeName: 'Phase 3 Cabs',
      businessType: 'Private Limited',
      city: 'Bengaluru',
      state: 'Karnataka',
      pinCode: '560001',
      billingAddress: { city: 'Bengaluru', state: 'Karnataka' },
    })
    expect(profile.status).toBe(200)
    expect(profile.body.data.tradeName).toBe('Phase 3 Cabs')

    const tax = await tenantRequest('patch', '/tax-settings').send({
      gstin: '29ABCDE1234F1Z5',
      pan: 'ABCDE1234F',
      stateCode: '29',
      taxRegistrationType: 'Regular',
      taxSettings: { taxInclusive: false },
    })
    expect(tax.status).toBe(200)

    const invoice = await tenantRequest('patch', '/invoice-settings').send({
      invoicePrefix: 'INV',
      invoiceNumberLength: 6,
      invoiceSettings: { nextNumber: 1, terms: 'Due in 15 days' },
    })
    expect(invoice.status).toBe(200)

    const location = await tenantRequest('post', '/locations').send({
      name: 'Head Office',
      code: 'HO',
      city: 'Bengaluru',
      state: 'Karnataka',
      isPrimary: true,
    })
    expect(location.status).toBe(201)
    const locationId = location.body.data.id as string

    const bank = await tenantRequest('post', '/bank-accounts').send({
      accountName: 'Phase 3 Test Private Limited',
      bankName: 'Test Bank',
      accountNumber: '123456789012',
      ifscCode: 'TEST0000123',
      isDefault: true,
    })
    expect(bank.status).toBe(201)

    const gst = await tenantRequest('post', '/gst-registrations').send({
      registrationName: 'Karnataka Registration',
      legalName: 'Phase 3 Test Private Limited',
      registrationType: 'Regular',
      gstin: '29ABCDE1234F1Z5',
      state: 'Karnataka',
      stateCode: '29',
      isDefault: true,
      locationIds: [locationId],
    })
    expect(gst.status).toBe(201)
    expect(gst.body.data.locations[0].location.id).toBe(locationId)

    const onboarding = await tenantRequest('get', '/onboarding')
    expect(onboarding.status).toBe(200)
    expect(onboarding.body.data.onboardingStatus).toBe('COMPLETED')
    const onboardingItems = onboarding.body.data.onboardingItems as Array<{
      isCompleted: boolean
    }>
    expect(onboardingItems.every((item) => item.isCompleted)).toBe(true)

    const persistedTenant = await prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
    })
    expect(persistedTenant.invoiceSettings).toEqual({
      nextNumber: 1,
      terms: 'Due in 15 days',
    })
  })

  it('creates custom roles and usable tenant users with location assignments', async () => {
    const permissions = await tenantRequest('get', '/permissions')
    expect(permissions.status).toBe(200)
    const permissionList = permissions.body.data as Array<{
      id: string
      permissionKey: string
    }>
    const profilePermission = permissionList.find(
      (permission: { permissionKey: string }) =>
        permission.permissionKey === 'user.profile.view',
    )
    expect(profilePermission).toBeDefined()

    const role = await tenantRequest('post', '/roles').send({
      name: 'Branch User',
      code: 'BRANCH_USER',
      permissionIds: [profilePermission!.id],
      status: 'ACTIVE',
    })
    expect(role.status).toBe(201)

    const location = await prisma.tenantLocation.findFirstOrThrow({
      where: { tenantId },
    })
    const userPassword = 'Branch-User!8Pq4#Secure'
    const user = await tenantRequest('post', '/users').send({
      name: 'Branch User',
      email: 'branch@phase3.example.com',
      password: userPassword,
      roleId: role.body.data.id,
      locationIds: [location.id],
      status: 'ACTIVE',
    })
    expect(user.status).toBe(201)
    expect(user.body.data).not.toHaveProperty('passwordHash')
    expect(user.body.data.locations[0].location.id).toBe(location.id)

    const login = await request(app).post('/api/v1/auth/login').send({
      email: 'branch@phase3.example.com',
      password: userPassword,
    })
    expect(login.status).toBe(200)
    const access = await request(app)
      .get('/api/v1/tenant/access')
      .set('Authorization', `Bearer ${login.body.data.accessToken}`)
    expect(access.status).toBe(200)
    expect(access.body.data.tenant.id).toBe(tenantId)
  })

  it('enforces tenant isolation and protects system roles', async () => {
    const otherTenant = await prisma.tenant.create({
      data: {
        code: 'PHASE3_OTHER',
        legalName: 'Other Tenant',
        email: 'other@example.com',
        mobile: '8888888888',
      },
    })
    const otherLocation = await prisma.tenantLocation.create({
      data: {
        tenantId: otherTenant.id,
        name: 'Other Location',
      },
    })

    const crossTenantUpdate = await tenantRequest(
      'patch',
      `/locations/${otherLocation.id}`,
    ).send({ name: 'Unauthorized Update' })
    expect(crossTenantUpdate.status).toBe(404)

    const systemRoleUpdate = await tenantRequest(
      'patch',
      `/roles/${ownerRoleId}/permissions`,
    ).send({ permissionIds: [] })
    expect(systemRoleUpdate.status).toBe(409)
    expect(systemRoleUpdate.body.code).toBe('SYSTEM_ROLE_PROTECTED')
  })
})
