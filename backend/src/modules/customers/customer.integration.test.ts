import request from 'supertest'
import { app } from '../../app'
import { prisma } from '../../config/prisma'
import { hashPassword } from '../../shared/security/password'
import { TENANT_PERMISSIONS } from '../auth/auth.constants'

const password = 'Customer-Test!9Qv7#Secure'
let token: string
let tenantId: string

async function cleanDatabase() {
  await prisma.booking.deleteMany()
  await prisma.vehicle.deleteMany()
  await prisma.vehicleType.deleteMany()
  await prisma.driver.deleteMany()
  await prisma.vendor.deleteMany()
  await prisma.customer.deleteMany()
  await prisma.tenantAuditLog.deleteMany()
  await prisma.tenantRefreshToken.deleteMany()
  await prisma.tenantRolePermission.deleteMany()
  await prisma.tenantUser.deleteMany()
  await prisma.tenantRole.deleteMany()
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
      code: 'CUSTOMER_TEST',
      legalName: 'Customer Test Private Limited',
      email: 'office@customer-test.example.com',
      mobile: '9999999999',
      status: 'ACTIVE',
    },
  })
  tenantId = tenant.id
  const role = await prisma.tenantRole.create({
    data: {
      tenantId,
      name: 'Customer Admin',
      code: 'CUSTOMER_ADMIN',
      status: 'ACTIVE',
    },
  })
  await prisma.tenantRolePermission.createMany({
    data: permissions.map((permission) => ({
      tenantId,
      roleId: role.id,
      permissionId: permission.id,
    })),
  })
  await prisma.tenantUser.create({
    data: {
      tenantId,
      roleId: role.id,
      name: 'Customer Admin',
      email: 'admin@customer-test.example.com',
      passwordHash: await hashPassword(password),
      status: 'ACTIVE',
    },
  })
  const plan = await prisma.subscriptionPlan.create({
    data: {
      code: 'CUSTOMER_PLAN',
      name: 'Customer Plan',
      billingCycle: 'ANNUAL',
      basePrice: 1000,
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
      amount: 1000,
      finalAmount: 1000,
      paymentStatus: 'PAID',
    },
  })
  const login = await request(app).post('/api/v1/auth/login').send({
    email: 'admin@customer-test.example.com',
    password,
  })
  expect(login.status).toBe(200)
  token = login.body.data.accessToken as string
})

afterAll(async () => {
  await cleanDatabase()
  await prisma.$disconnect()
})

function authenticated(
  method: 'get' | 'post' | 'patch' | 'delete',
  path: string,
) {
  return request(app)
    [method](`/api/v1/tenant/customers${path}`)
    .set('Authorization', `Bearer ${token}`)
}

describe('customer APIs', () => {
  it('creates, reads, searches, and updates a permanent customer', async () => {
    const created = await authenticated('post', '').send({
      type: 'CORPORATE',
      name: 'ACME CORPORATION',
      billingName: 'acme corporation private limited',
      email: 'travel@acme.example.com',
      phone: '9999999998',
      city: 'NEW DELHI',
      gstin: '29ABCDE1234F1Z5',
      billingAddress: 'MG Road, Bengaluru',
      creditLimit: 250000,
    })
    expect(created.status).toBe(201)
    expect(created.body.data.name).toBe('Acme Corporation')
    expect(created.body.data.city).toBe('New Delhi')
    expect(created.body.data.customerCode).toMatch(/^CUST-/)
    expect(created.body.data.contacts[0].isPrimary).toBe(true)
    const customerId = created.body.data.id as string

    const list = await authenticated('get', '?search=Acme&type=CORPORATE')
    expect(list.status).toBe(200)
    expect(list.body.data).toHaveLength(1)

    const updated = await authenticated('patch', `/${customerId}`).send({
      city: 'Mumbai',
      creditLimit: 300000,
    })
    expect(updated.status).toBe(200)
    expect(updated.body.data.city).toBe('Mumbai')
    expect(updated.body.data.creditLimit).toBe(300000)

    const detail = await authenticated('get', `/${customerId}`)
    expect(detail.status).toBe(200)
    expect(detail.body.data.id).toBe(customerId)

    expect((await authenticated('delete', `/${customerId}`)).status).toBe(404)
    expect((await authenticated('get', `/${customerId}`)).status).toBe(200)
  })

  it('creates a tenant-scoped traveller and blocks cross-tenant access', async () => {
    const created = await authenticated('post', '').send({
      type: 'CORPORATE',
      name: 'Traveller Company',
      billingName: 'Traveller Company',
      email: 'travel@traveller.example.com',
      phone: '8888888888',
      city: 'Delhi',
      billingAddress: 'Connaught Place, Delhi',
    })
    const customerId = created.body.data.id as string
    const traveller = await authenticated(
      'post',
      `/${customerId}/travellers`,
    ).send({
      travellerType: 'Employee',
      salutation: 'MS',
      name: 'PRIYANKA SINGH',
      phone: '7777777777',
      email: 'employee@traveller.example.com',
      employeeId: 'EMP-100',
      department: 'Travel Desk',
    })
    expect(traveller.status).toBe(201)
    expect(traveller.body.data.name).toBe('Priyanka Singh')
    expect(traveller.body.data.salutation).toBe('MS')
    const travellerId = traveller.body.data.id as string

    const detail = await authenticated('get', `/${customerId}`)
    expect(detail.body.data.travellers[0].employeeId).toBe('EMP-100')

    const employeeDetail = await authenticated(
      'get',
      `/${customerId}/travellers/${travellerId}`,
    )
    expect(employeeDetail.status).toBe(200)

    const employeeUpdate = await authenticated(
      'patch',
      `/${customerId}/travellers/${travellerId}`,
    ).send({ department: 'senior travel desk', notes: 'VIP BOOKINGS' })
    expect(employeeUpdate.status).toBe(200)
    expect(employeeUpdate.body.data.department).toBe('Senior Travel Desk')
    expect(employeeUpdate.body.data.notes).toBe('Vip Bookings')

    const otherTenant = await prisma.tenant.create({
      data: {
        code: 'CUSTOMER_OTHER',
        legalName: 'Other Customer Tenant',
        email: 'other@customer.example.com',
        mobile: '6666666666',
      },
    })
    const otherCustomer = await prisma.customer.create({
      data: {
        tenantId: otherTenant.id,
        customerCode: 'CUST-OTHER',
        type: 'RETAIL',
        name: 'Other Customer',
        billingName: 'Other Customer',
        email: 'person@other.example.com',
        phone: '6666666665',
        city: 'Pune',
        billingAddress: 'Pune',
      },
    })
    expect((await authenticated('get', `/${otherCustomer.id}`)).status).toBe(
      404,
    )
    expect(
      (
        await authenticated('patch', `/${otherCustomer.id}`).send({
          city: 'Unauthorized',
        })
      ).status,
    ).toBe(404)

    const employeeDeleteAttempt = await authenticated(
      'delete',
      `/${customerId}/travellers/${travellerId}`,
    )
    expect(employeeDeleteAttempt.status).toBe(404)
    expect(
      (await authenticated('get', `/${customerId}/travellers/${travellerId}`))
        .status,
    ).toBe(200)
  })
})
