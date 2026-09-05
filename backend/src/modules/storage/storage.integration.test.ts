import { rm, stat, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import request from 'supertest'
import { app } from '../../app'
import { env } from '../../config/env'
import { prisma } from '../../config/prisma'
import { hashPassword } from '../../shared/security/password'
import { TENANT_PERMISSIONS } from '../auth/auth.constants'

const password = 'Storage-Test!9Qv7#Secure'
let tenantA: string
let tenantB: string
let vehicleA: string
let invoiceA: string
let tokenA: string
let tokenB: string
let restrictedToken: string

async function clean() {
  await prisma.storedFile.deleteMany()
  await prisma.invoice.deleteMany()
  await prisma.customer.deleteMany()
  await prisma.vehicle.deleteMany()
  await prisma.vehicleType.deleteMany()
  await prisma.tenantAuditLog.deleteMany()
  await prisma.tenantRefreshToken.deleteMany()
  await prisma.tenantRolePermission.deleteMany()
  await prisma.tenantUser.deleteMany()
  await prisma.tenantRole.deleteMany()
  await prisma.tenantSubscription.deleteMany()
  await prisma.tenant.deleteMany()
  await prisma.permission.deleteMany()
  await prisma.subscriptionPlan.deleteMany()
  await rm(env.storage.localRoot, { recursive: true, force: true })
  await rm(env.storage.tempRoot, { recursive: true, force: true })
}

async function createTenant(code: string, email: string, planId: string) {
  const tenant = await prisma.tenant.create({
    data: {
      code,
      legalName: code,
      email,
      mobile: '9999999999',
      status: 'ACTIVE',
    },
  })
  const role = await prisma.tenantRole.create({
    data: {
      tenantId: tenant.id,
      name: 'Admin',
      code: 'ADMIN',
      status: 'ACTIVE',
    },
  })
  const permissions = await prisma.permission.findMany()
  await prisma.tenantRolePermission.createMany({
    data: permissions.map((permission) => ({
      tenantId: tenant.id,
      roleId: role.id,
      permissionId: permission.id,
    })),
  })
  await prisma.tenantUser.create({
    data: {
      tenantId: tenant.id,
      roleId: role.id,
      name: `${code} Owner`,
      email,
      passwordHash: await hashPassword(password),
      status: 'ACTIVE',
      isPrimaryOwner: true,
    },
  })
  await prisma.tenantSubscription.create({
    data: {
      tenantId: tenant.id,
      planId,
      status: 'ACTIVE',
      billingCycle: 'ANNUAL',
      startsAt: new Date(Date.now() - 86_400_000),
      expiresAt: new Date(Date.now() + 86_400_000),
      amount: 100,
      finalAmount: 100,
      paymentStatus: 'PAID',
    },
  })
  const login = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password })
  return { id: tenant.id, token: login.body.data.accessToken as string }
}

beforeAll(async () => {
  await clean()
  await Promise.all(
    TENANT_PERMISSIONS.map(([module, action]) =>
      prisma.permission.create({
        data: { module, action, permissionKey: `${module}.${action}` },
      }),
    ),
  )
  const plan = await prisma.subscriptionPlan.create({
    data: {
      code: 'STORAGE_PLAN',
      name: 'Storage Plan',
      billingCycle: 'ANNUAL',
      basePrice: 100,
    },
  })
  const a = await createTenant('STORAGE_A', 'storage-a@example.com', plan.id)
  const b = await createTenant('STORAGE_B', 'storage-b@example.com', plan.id)
  tenantA = a.id
  tenantB = b.id
  tokenA = a.token
  tokenB = b.token
  const vehicleType = await prisma.vehicleType.create({
    data: { tenantId: tenantA, name: 'Sedan', status: 'ACTIVE' },
  })
  vehicleA = (
    await prisma.vehicle.create({
      data: {
        tenantId: tenantA,
        vehicleCode: 'STO-VEH-1',
        registrationNumber: 'UP70ST0001',
        ownershipType: 'OWN',
        vehicleTypeId: vehicleType.id,
        status: 'ACTIVE',
        createdById: (
          await prisma.tenantUser.findFirstOrThrow({
            where: { tenantId: tenantA },
          })
        ).id,
        updatedById: (
          await prisma.tenantUser.findFirstOrThrow({
            where: { tenantId: tenantA },
          })
        ).id,
      },
    })
  ).id
  const actorId = (
    await prisma.tenantUser.findFirstOrThrow({ where: { tenantId: tenantA } })
  ).id
  const customer = await prisma.customer.create({
    data: {
      tenantId: tenantA,
      customerCode: 'STO-CUST-1',
      type: 'CORPORATE',
      name: 'Storage Customer',
      billingName: 'Storage Customer',
      phone: '9999999998',
      billingAddress: 'Test address',
    },
  })
  invoiceA = (
    await prisma.invoice.create({
      data: {
        tenantId: tenantA,
        customerId: customer.id,
        invoiceDate: new Date('2026-04-01'),
        status: 'GENERATED',
        financialYear: '26-27',
        gstType: 'NO_GST',
        billingName: customer.billingName,
        billingAddress: customer.billingAddress!,
        subtotal: 100,
        taxableAmount: 100,
        netPayable: 100,
        createdById: actorId,
        updatedById: actorId,
      },
    })
  ).id
  const restrictedRole = await prisma.tenantRole.create({
    data: {
      tenantId: tenantA,
      name: 'Restricted',
      code: 'STORAGE_RESTRICTED',
      status: 'ACTIVE',
    },
  })
  await prisma.tenantUser.create({
    data: {
      tenantId: tenantA,
      roleId: restrictedRole.id,
      name: 'Restricted User',
      email: 'storage-restricted@example.com',
      passwordHash: await hashPassword(password),
      status: 'ACTIVE',
    },
  })
  restrictedToken = (
    await request(app).post('/api/v1/auth/login').send({
      email: 'storage-restricted@example.com',
      password,
    })
  ).body.data.accessToken as string
})

afterAll(async () => {
  await clean()
  await prisma.$disconnect()
})

function upload(
  token: string,
  options?: { entityId?: string; name?: string; type?: string },
) {
  return request(app)
    .post('/api/v1/tenant/files')
    .set('Authorization', `Bearer ${token}`)
    .field('tenantId', tenantB)
    .field('entityType', 'VEHICLE')
    .field('entityId', options?.entityId ?? vehicleA)
    .field('documentType', 'RC')
    .attach('file', Buffer.from('%PDF-1.7 storage test'), {
      filename: options?.name ?? 'rc.pdf',
      contentType: options?.type ?? 'application/pdf',
    })
}

describe('central storage API', () => {
  it('uploads, checksums, lists, and streams a tenant-owned file', async () => {
    const response = await upload(tokenA)
    expect(response.status).toBe(201)
    expect(response.body.data).toMatchObject({
      entityType: 'VEHICLE',
      entityId: vehicleA,
      documentType: 'RC',
      originalFileName: 'rc.pdf',
      mimeType: 'application/pdf',
    })
    expect(response.body.data.storageKey).toBeUndefined()
    const fileId = response.body.data.id as string
    const stored = await prisma.storedFile.findUniqueOrThrow({
      where: { id: fileId },
    })
    expect(stored.tenantId).toBe(tenantA)
    expect(stored.storageKey).toMatch(
      new RegExp(`^tenants/${tenantA}/vehicles/${vehicleA}/`),
    )
    expect(stored.checksum).toMatch(/^[a-f0-9]{64}$/)
    await expect(
      stat(join(env.storage.localRoot, stored.storageKey)),
    ).resolves.toBeDefined()
    expect(
      await prisma.tenantAuditLog.count({
        where: { tenantId: tenantA, action: 'UPLOAD' },
      }),
    ).toBe(1)

    const listed = await request(app)
      .get(`/api/v1/tenant/files?entityType=VEHICLE&entityId=${vehicleA}`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(listed.body.data).toHaveLength(1)
    const viewed = await request(app)
      .get(`/api/v1/tenant/files/${fileId}/view`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(viewed.status).toBe(200)
    expect(viewed.headers['content-type']).toMatch('application/pdf')
    expect(viewed.headers['content-disposition']).toMatch(/^inline/)
    expect(viewed.body).toEqual(Buffer.from('%PDF-1.7 storage test'))
    const downloaded = await request(app)
      .get(`/api/v1/tenant/files/${fileId}/download`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(downloaded.headers['content-disposition']).toMatch(/^attachment/)
  })

  it('prevents cross-tenant list, read, download, and delete access', async () => {
    const fileId = (await upload(tokenA)).body.data.id as string
    expect(
      (
        await request(app)
          .get('/api/v1/tenant/files')
          .set('Authorization', `Bearer ${tokenB}`)
      ).body.data,
    ).toEqual([])
    for (const methodPath of [
      `/api/v1/tenant/files/${fileId}`,
      `/api/v1/tenant/files/${fileId}/download`,
    ])
      expect(
        (
          await request(app)
            .get(methodPath)
            .set('Authorization', `Bearer ${tokenB}`)
        ).status,
      ).toBe(404)
    expect(
      (
        await request(app)
          .delete(`/api/v1/tenant/files/${fileId}`)
          .set('Authorization', `Bearer ${tokenB}`)
      ).status,
    ).toBe(404)
  })

  it('rejects foreign/missing entities, dangerous extensions, and spoofed content', async () => {
    expect((await upload(tokenB, { entityId: vehicleA })).status).toBe(404)
    expect(
      (
        await upload(tokenA, {
          entityId: '00000000-0000-4000-8000-000000000099',
        })
      ).status,
    ).toBe(404)
    expect((await upload(tokenA, { name: '../../payload.exe' })).status).toBe(
      415,
    )
    expect(
      (await upload(tokenA, { name: 'rc.png', type: 'image/png' })).status,
    ).toBe(415)
  })

  it('does not overwrite duplicate names and isolates physical keys', async () => {
    const first = await upload(tokenA)
    const second = await upload(tokenA)
    expect(first.status).toBe(201)
    expect(second.status).toBe(201)
    const records = await prisma.storedFile.findMany({
      where: { id: { in: [first.body.data.id, second.body.data.id] } },
    })
    expect(new Set(records.map((record) => record.storageKey)).size).toBe(2)
  })

  it('handles concurrent uploads with identical original names', async () => {
    const responses = await Promise.all(
      Array.from({ length: 5 }, () => upload(tokenA)),
    )
    expect(responses.every((response) => response.status === 201)).toBe(true)
    expect(
      new Set(
        responses.map((response) =>
          String((response.body as { data: { id: unknown } }).data.id),
        ),
      ).size,
    ).toBe(5)
  })

  it('reports tenant usage from metadata rather than scanning disk', async () => {
    const before = (
      await request(app)
        .get('/api/v1/tenant/files/usage')
        .set('Authorization', `Bearer ${tokenA}`)
    ).body.data.bytes as number
    await upload(tokenA)
    const after = (
      await request(app)
        .get('/api/v1/tenant/files/usage')
        .set('Authorization', `Bearer ${tokenA}`)
    ).body.data.bytes as number
    expect(after - before).toBe(Buffer.byteLength('%PDF-1.7 storage test'))
    expect(
      (
        await request(app)
          .get('/api/v1/tenant/files/usage')
          .set('Authorization', `Bearer ${tokenB}`)
      ).body.data.bytes,
    ).toBe(0)
  })

  it('rejects oversized multipart uploads before storage', async () => {
    const response = await request(app)
      .post('/api/v1/tenant/files')
      .set('Authorization', `Bearer ${tokenA}`)
      .field('entityType', 'VEHICLE')
      .field('entityId', vehicleA)
      .field('documentType', 'RC')
      .attach('file', Buffer.alloc(env.storage.maxFileSizeBytes + 1, 1), {
        filename: 'large.pdf',
        contentType: 'application/pdf',
      })
    expect(response.status).toBe(413)
    expect(response.body.code).toBe('FILE_TOO_LARGE')
  })

  it('keeps final invoice PDFs immutable', async () => {
    const created = await request(app)
      .post('/api/v1/tenant/files')
      .set('Authorization', `Bearer ${tokenA}`)
      .field('entityType', 'INVOICE')
      .field('entityId', invoiceA)
      .field('documentType', 'FINAL_PDF')
      .attach('file', Buffer.from('%PDF-1.7 final invoice'), {
        filename: 'INV-26-27-0001.pdf',
        contentType: 'application/pdf',
      })
    expect(created.status).toBe(201)
    const stored = await prisma.storedFile.findUniqueOrThrow({
      where: { id: created.body.data.id },
    })
    expect(stored.storageKey).toContain(`/invoices/26-27/${invoiceA}/`)
    const deleted = await request(app)
      .delete(`/api/v1/tenant/files/${stored.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(deleted.status).toBe(409)
    expect(deleted.body.code).toBe('IMMUTABLE_DOCUMENT')
  })

  it('soft deletes metadata while retaining bytes and blocks normal download', async () => {
    const fileId = (await upload(tokenA)).body.data.id as string
    const storageKey = (
      await prisma.storedFile.findUniqueOrThrow({ where: { id: fileId } })
    ).storageKey
    expect(
      (
        await request(app)
          .delete(`/api/v1/tenant/files/${fileId}`)
          .set('Authorization', `Bearer ${tokenA}`)
      ).status,
    ).toBe(200)
    expect(
      (await prisma.storedFile.findUniqueOrThrow({ where: { id: fileId } }))
        .deletedAt,
    ).not.toBeNull()
    expect(
      (
        await request(app)
          .get(`/api/v1/tenant/files/${fileId}/download`)
          .set('Authorization', `Bearer ${tokenA}`)
      ).status,
    ).toBe(404)
    await expect(
      stat(join(env.storage.localRoot, storageKey)),
    ).resolves.toBeDefined()
  })

  it('returns a controlled error when physical bytes are missing', async () => {
    const fileId = (await upload(tokenA)).body.data.id as string
    const stored = await prisma.storedFile.findUniqueOrThrow({
      where: { id: fileId },
    })
    await unlink(join(env.storage.localRoot, stored.storageKey))
    const response = await request(app)
      .get(`/api/v1/tenant/files/${fileId}/download`)
      .set('Authorization', `Bearer ${tokenA}`)
    expect(response.status).toBe(404)
    expect(response.body.code).toBe('STORAGE_READ_FAILED')
  })

  it('rejects unauthenticated and unpermitted users', async () => {
    expect((await request(app).get('/api/v1/tenant/files')).status).toBe(401)
    expect(
      (
        await request(app)
          .get('/api/v1/tenant/files')
          .set('Authorization', `Bearer ${restrictedToken}`)
      ).status,
    ).toBe(403)
  })
})
