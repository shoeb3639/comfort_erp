import request from 'supertest'
import { app } from '../../app'
import { prisma } from '../../config/prisma'
import { hashPassword } from '../../shared/security/password'
import { TENANT_PERMISSIONS } from '../auth/auth.constants'

const password = 'Vendor-Test!9Qv7#Secure'
let token: string
let tenantId: string

async function clean() {
  await prisma.booking.deleteMany()
  await prisma.vehicle.deleteMany()
  await prisma.vehicleType.deleteMany()
  await prisma.driver.deleteMany()
  await prisma.vendor.deleteMany()
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
  await clean()
  const permissions = await Promise.all(
    TENANT_PERMISSIONS.map(([module, action]) =>
      prisma.permission.create({
        data: { module, action, permissionKey: `${module}.${action}` },
      }),
    ),
  )
  const tenant = await prisma.tenant.create({
    data: {
      code: 'VENDOR_TEST',
      legalName: 'Vendor Test',
      email: 'vendor@test.example.com',
      mobile: '9999999999',
      status: 'ACTIVE',
    },
  })
  tenantId = tenant.id
  const role = await prisma.tenantRole.create({
    data: { tenantId, name: 'Vendor Admin', code: 'VENDOR_ADMIN' },
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
      name: 'Vendor Admin',
      email: 'admin@vendor-test.example.com',
      passwordHash: await hashPassword(password),
      status: 'ACTIVE',
    },
  })
  const plan = await prisma.subscriptionPlan.create({
    data: {
      code: 'VENDOR_PLAN',
      name: 'Vendor Plan',
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
    },
  })
  const login = await request(app).post('/api/v1/auth/login').send({
    email: 'admin@vendor-test.example.com',
    password,
  })
  token = login.body.data.accessToken as string
})
afterAll(async () => {
  await clean()
  await prisma.$disconnect()
})
function api(method: 'get' | 'post' | 'patch' | 'delete', path = '') {
  return request(app)
    [method](`/api/v1/tenant/vendors${path}`)
    .set('Authorization', `Bearer ${token}`)
}

describe('vendor module', () => {
  it('uses current database permissions without requiring a new token', async () => {
    const user = await prisma.tenantUser.findFirstOrThrow({
      where: { tenantId, email: 'admin@vendor-test.example.com' },
    })
    const permission = await prisma.permission.findUniqueOrThrow({
      where: { permissionKey: 'vendor.view' },
    })
    await prisma.tenantRolePermission.deleteMany({
      where: { tenantId, roleId: user.roleId, permissionId: permission.id },
    })
    expect((await api('get')).status).toBe(403)

    await prisma.tenantRolePermission.create({
      data: {
        tenantId,
        roleId: user.roleId,
        permissionId: permission.id,
      },
    })
    expect((await api('get')).status).toBe(200)
  })

  it('completes vendor, vehicle, and driver CRUD with normalization', async () => {
    const vendor = await api('post').send({
      name: 'PRIME CABS',
      recordType: 'external_vendor',
      category: 'FLEET',
      rating: 4.5,
      phone: '9999999998',
      city: 'NEW DELHI',
    })
    expect(vendor.status).toBe(201)
    expect(vendor.body.data.name).toBe('Prime Cabs')
    expect(vendor.body.data.city).toBe('New Delhi')
    const vendorId = vendor.body.data.id as string

    const vehicle = await api('post', `/${vendorId}/vehicles`).send({
      plate: 'dl01ab1234',
      type: 'SUV',
      make: 'TATA NEXON',
      seatingCapacity: 5,
      status: 'Ready',
    })
    expect(vehicle.status).toBe(201)
    expect(vehicle.body.data.plate).toBe('DL01AB1234')
    const vehicleId = vehicle.body.data.id as string

    const driver = await api('post', `/${vendorId}/drivers`).send({
      salutation: 'MR',
      name: 'GAURAV CHADDHA',
      license: 'dl-12345',
      phone: '8888888888',
      city: 'NEW DELHI',
      status: 'Available',
    })
    expect(driver.status).toBe(201)
    expect(driver.body.data.displayName).toBe('Mr. Gaurav Chaddha')
    const driverId = driver.body.data.id as string

    const list = await api('get', '?search=Prime&status=ACTIVE')
    expect(list.status).toBe(200)
    expect(list.body.data[0].vehicles).toHaveLength(1)
    expect(list.body.data[0].drivers).toHaveLength(1)

    expect(
      (
        await api('patch', `/${vendorId}/vehicles/${vehicleId}`).send({
          status: 'Maintenance',
        })
      ).status,
    ).toBe(200)
    expect(
      (
        await api('patch', `/${vendorId}/drivers/${driverId}`).send({
          city: 'GURUGRAM',
        })
      ).body.data.city,
    ).toBe('Gurugram')

    expect((await api('delete', `/${vendorId}`)).status).toBe(409)
    expect(
      (await api('delete', `/${vendorId}/vehicles/${vehicleId}`)).status,
    ).toBe(200)
    expect(
      (await api('delete', `/${vendorId}/drivers/${driverId}`)).status,
    ).toBe(200)
    expect((await api('delete', `/${vendorId}`)).status).toBe(200)
  })

  it('blocks cross-tenant vendor access', async () => {
    const other = await prisma.tenant.create({
      data: {
        code: 'VENDOR_OTHER',
        legalName: 'Other',
        email: 'other@vendor.example.com',
        mobile: '7777777777',
      },
    })
    const vendor = await prisma.vendor.create({
      data: {
        tenantId: other.id,
        vendorCode: 'VEN-OTHER',
        name: 'Other Vendor',
        recordType: 'external_vendor',
        category: 'Fleet',
        phone: '7777777776',
        city: 'Pune',
      },
    })
    expect((await api('get', `/${vendor.id}`)).status).toBe(404)
    expect(
      (await api('patch', `/${vendor.id}`).send({ city: 'Unauthorized' }))
        .status,
    ).toBe(404)
  })

  it('uses unified central masters and enforces OWN vendor rules', async () => {
    const vehicleType = await prisma.vehicleType.create({
      data: { tenantId, name: 'Sedan' },
    })
    const vehicles = request(app)
      .post('/api/v1/tenant/vehicles')
      .set('Authorization', `Bearer ${token}`)
    const vehicle = await vehicles.send({
      ownershipType: 'OWN',
      vendorId: null,
      registrationNumber: 'up 70-own-1234',
      vehicleTypeId: vehicleType.id,
      make: 'MARUTI',
      model: 'DZIRE',
    })
    expect(vehicle.status).toBe(201)
    expect(vehicle.body.data.registrationNumber).toBe('UP70OWN1234')
    expect(vehicle.body.data.vendorId).toBeNull()

    const invalidVehicle = await request(app)
      .post('/api/v1/tenant/vehicles')
      .set('Authorization', `Bearer ${token}`)
      .send({
        ownershipType: 'OWN',
        vendorId: '00000000-0000-4000-8000-000000000001',
        registrationNumber: 'UP70INVALID',
        vehicleTypeId: vehicleType.id,
      })
    expect(invalidVehicle.status).toBe(400)

    const driver = await request(app)
      .post('/api/v1/tenant/drivers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        engagementType: 'OWN',
        vendorId: null,
        salutation: 'MS',
        name: 'PRIYANKA SINGH',
        mobile: '8888888877',
        licenceNumber: 'UP-OWN-9988',
      })
    expect(driver.status).toBe(201)
    expect(driver.body.data.displayName).toBe('Ms. Priyanka Singh')
    expect(driver.body.data.vendorId).toBeNull()

    expect(
      (
        await request(app)
          .get('/api/v1/tenant/vehicles?ownershipType=OWN')
          .set('Authorization', `Bearer ${token}`)
      ).body.data,
    ).toHaveLength(1)
    expect(
      (
        await request(app)
          .get('/api/v1/tenant/drivers?engagementType=OWN')
          .set('Authorization', `Bearer ${token}`)
      ).body.data,
    ).toHaveLength(1)
  })
})
