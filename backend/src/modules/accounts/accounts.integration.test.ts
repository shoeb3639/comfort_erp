import request from 'supertest'
import { app } from '../../app'
import { prisma } from '../../config/prisma'
import { hashPassword } from '../../shared/security/password'

const password = 'Accounts-Test!9Qv7#Secure'
const tenantCode = 'ACCOUNTS_TEST'
let tenantId: string
let planId: string
let userId: string
let locationId: string
let token: string

async function clean() {
  const tenant = await prisma.tenant.findUnique({
    where: { code: tenantCode },
    select: { id: true },
  })
  if (tenant) {
    await prisma.companyFundRelease.deleteMany({
      where: { tenantId: tenant.id },
    })
    await prisma.managerLedgerEntry.deleteMany({
      where: { tenantId: tenant.id },
    })
    await prisma.managerLedger.deleteMany({ where: { tenantId: tenant.id } })
    await prisma.tenantAuditLog.deleteMany({ where: { tenantId: tenant.id } })
    await prisma.accountReference.deleteMany({
      where: { tenantId: tenant.id },
    })
    await prisma.tenantRefreshToken.deleteMany({
      where: { tenantId: tenant.id },
    })
    await prisma.tenantRolePermission.deleteMany({
      where: { tenantId: tenant.id },
    })
    await prisma.tenantLocation.deleteMany({ where: { tenantId: tenant.id } })
    await prisma.tenantUser.deleteMany({ where: { tenantId: tenant.id } })
    await prisma.tenantRole.deleteMany({ where: { tenantId: tenant.id } })
    await prisma.tenantSubscription.deleteMany({
      where: { tenantId: tenant.id },
    })
    await prisma.tenant.delete({ where: { id: tenant.id } })
  }
  await prisma.subscriptionPlan.deleteMany({
    where: { code: 'ACCOUNTS_TEST_PLAN' },
  })
}

beforeAll(async () => {
  await clean()
  const plan = await prisma.subscriptionPlan.create({
    data: {
      code: 'ACCOUNTS_TEST_PLAN',
      name: 'Accounts Test Plan',
      billingCycle: 'MONTHLY',
      basePrice: 1000,
    },
  })
  planId = plan.id
  const tenant = await prisma.tenant.create({
    data: {
      code: tenantCode,
      legalName: 'Accounts Test Tenant',
      email: 'accounts-tenant@example.com',
      mobile: '9999999999',
      status: 'ACTIVE',
    },
  })
  tenantId = tenant.id
  const role = await prisma.tenantRole.create({
    data: {
      tenantId,
      name: 'Accounts Viewer',
      code: 'ACCOUNTS_MANAGER',
    },
  })
  await prisma.permission.createMany({
    data: [
      {
        module: 'accounts.collection',
        action: 'view',
        permissionKey: 'accounts.collection.view',
      },
      {
        module: 'accounts.ledger',
        action: 'view',
        permissionKey: 'accounts.ledger.view',
      },
      {
        module: 'accounts.fund',
        action: 'release',
        permissionKey: 'accounts.fund.release',
      },
    ],
    skipDuplicates: true,
  })
  const permissions = await prisma.permission.findMany({
    where: {
      permissionKey: {
        in: [
          'accounts.collection.view',
          'accounts.ledger.view',
          'accounts.fund.release',
        ],
      },
    },
  })
  await prisma.tenantRolePermission.createMany({
    data: permissions.map((permission) => ({
      tenantId,
      roleId: role.id,
      permissionId: permission.id,
    })),
  })
  const user = await prisma.tenantUser.create({
    data: {
      tenantId,
      roleId: role.id,
      name: 'Accounts Test User',
      email: 'accounts-user@example.com',
      passwordHash: await hashPassword(password),
      status: 'ACTIVE',
    },
  })
  userId = user.id
  const location = await prisma.tenantLocation.create({
    data: {
      tenantId,
      name: 'Delhi Office',
      code: 'DEL',
      city: 'New Delhi',
      state: 'Delhi',
      isPrimary: true,
      createdById: userId,
      updatedById: userId,
    },
  })
  locationId = location.id
  await prisma.tenantSubscription.create({
    data: {
      tenantId,
      planId,
      status: 'ACTIVE',
      billingCycle: 'MONTHLY',
      startsAt: new Date(Date.now() - 86400000),
      expiresAt: new Date(Date.now() + 30 * 86400000),
      amount: 1000,
      finalAmount: 1000,
      paymentStatus: 'PAID',
    },
  })
  await prisma.accountReference.create({
    data: {
      tenantId,
      referenceNumber: 'UTR-EXISTING-001',
      normalizedReferenceNumber: 'UTR-EXISTING-001',
      source: 'EXPENSE',
      createdById: userId,
      updatedById: userId,
    },
  })
  const login = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'accounts-user@example.com', password })
  token = login.body.data.accessToken as string
})

afterAll(async () => {
  await clean()
  await prisma.$disconnect()
})

describe('Accounts foundation APIs', () => {
  it('returns only authorized navigation and validates tenant references', async () => {
    const foundation = await request(app)
      .get('/api/v1/tenant/accounts/foundation')
      .set('Authorization', `Bearer ${token}`)

    expect(foundation.status).toBe(200)
    expect(foundation.body.data.permissions).toEqual([
      'accounts.collection.view',
      'accounts.ledger.view',
      'accounts.fund.release',
    ])
    expect(
      (foundation.body.data.navigation as Array<{ id: string }>).map(
        (item) => item.id,
      ),
    ).toEqual(['overview', 'collections', 'manager-ledger', 'fund-release'])

    const available = await request(app)
      .post('/api/v1/tenant/accounts/references/validate')
      .set('Authorization', `Bearer ${token}`)
      .send({ referenceNumber: '  utr-new-002  ' })
    expect(available.status).toBe(200)
    expect(available.body.data).toMatchObject({
      normalizedReferenceNumber: 'UTR-NEW-002',
      available: true,
    })

    const duplicate = await request(app)
      .post('/api/v1/tenant/accounts/references/validate')
      .set('Authorization', `Bearer ${token}`)
      .send({ referenceNumber: 'utr-existing-001' })
    expect(duplicate.status).toBe(200)
    expect(duplicate.body.data.available).toBe(false)
  })
})

describe('Manager ledger master APIs', () => {
  let ledgerId: string

  it('creates one manager/location ledger with an opening entry', async () => {
    const created = await request(app)
      .post('/api/v1/tenant/accounts/manager-ledgers')
      .set('Authorization', `Bearer ${token}`)
      .send({
        managerId: userId,
        locationId,
        openingBalance: 12500,
        remarks: 'operational opening fund',
      })

    expect(created.status).toBe(201)
    expect(created.body.data).toMatchObject({
      openingBalance: 12500,
      totalCredits: 0,
      totalDebits: 0,
      currentBalance: 12500,
      status: 'ACTIVE',
      remarks: 'Operational Opening Fund',
    })
    expect(created.body.data.entries[0]).toMatchObject({
      entryNumber: 1,
      entryType: 'OPENING_BALANCE',
      credit: 12500,
      debit: 0,
      balanceBefore: 0,
      runningBalance: 12500,
    })
    ledgerId = created.body.data.id as string
  })

  it('rejects duplicate manager/location ledgers', async () => {
    const duplicate = await request(app)
      .post('/api/v1/tenant/accounts/manager-ledgers')
      .set('Authorization', `Bearer ${token}`)
      .send({ managerId: userId, locationId, openingBalance: 0 })

    expect(duplicate.status).toBe(409)
    expect(duplicate.body.code).toBe('MANAGER_LEDGER_EXISTS')
  })

  it('lists, filters, and retrieves the database-backed running balance', async () => {
    const list = await request(app)
      .get(
        `/api/v1/tenant/accounts/manager-ledgers?status=ACTIVE&managerId=${userId}`,
      )
      .set('Authorization', `Bearer ${token}`)

    expect(list.status).toBe(200)
    expect(list.body.data.ledgers).toHaveLength(1)
    expect(list.body.data.summary).toMatchObject({
      totalLedgers: 1,
      activeLedgers: 1,
      openingBalance: 12500,
      currentBalance: 12500,
    })
    expect(list.body.data.formula).toBe(
      'Opening Balance + Credits - Debits = Current Balance',
    )

    const detail = await request(app)
      .get(`/api/v1/tenant/accounts/manager-ledgers/${ledgerId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(detail.status).toBe(200)
    expect(detail.body.data.manager.id).toBe(userId)
    expect(detail.body.data.location.id).toBe(locationId)
  })

  it('posts a verified company fund release as an atomic ledger credit', async () => {
    const released = await request(app)
      .post('/api/v1/tenant/accounts/fund-releases')
      .set('Authorization', `Bearer ${token}`)
      .send({
        ledgerId,
        releaseDate: '2026-07-29',
        amount: 7500,
        paymentMode: 'BANK_TRANSFER',
        referenceNumber: ' fund-utr-7500 ',
        description: 'operational trip advance',
        attachmentName: 'transfer-proof.pdf',
        remarks: 'approved for daily operations',
      })

    expect(released.status).toBe(201)
    expect(released.body.data).toMatchObject({
      amount: 7500,
      paymentMode: 'BANK_TRANSFER',
      referenceNumber: 'FUND-UTR-7500',
      description: 'Operational Trip Advance',
      status: 'VERIFIED',
      attachmentName: 'transfer-proof.pdf',
    })
    expect(released.body.data.releasedBy.id).toBe(userId)
    expect(released.body.data.verifiedBy.id).toBe(userId)

    const ledger = await request(app)
      .get(`/api/v1/tenant/accounts/manager-ledgers/${ledgerId}`)
      .set('Authorization', `Bearer ${token}`)
    expect(ledger.body.data).toMatchObject({
      openingBalance: 12500,
      totalCredits: 7500,
      totalDebits: 0,
      currentBalance: 20000,
    })
    expect(ledger.body.data.entries[0]).toMatchObject({
      entryNumber: 2,
      entryType: 'FUND_RELEASE',
      credit: 7500,
      debit: 0,
      balanceBefore: 12500,
      runningBalance: 20000,
      referenceNumber: 'FUND-UTR-7500',
    })
  })

  it('rejects duplicate fund-release references without changing balance', async () => {
    const duplicate = await request(app)
      .post('/api/v1/tenant/accounts/fund-releases')
      .set('Authorization', `Bearer ${token}`)
      .send({
        ledgerId,
        releaseDate: '2026-07-29',
        amount: 500,
        paymentMode: 'UPI',
        referenceNumber: 'fund-utr-7500',
        description: 'duplicate attempt',
      })

    expect(duplicate.status).toBe(409)
    expect(duplicate.body.code).toBe('DUPLICATE_REFERENCE')
    const unchanged = await prisma.managerLedger.findUniqueOrThrow({
      where: { tenantId_id: { tenantId, id: ledgerId } },
      select: { currentBalance: true },
    })
    expect(Number(unchanged.currentBalance)).toBe(20000)
  })

  it('lists and retrieves fund-release verification and audit details', async () => {
    const list = await request(app)
      .get(
        `/api/v1/tenant/accounts/fund-releases?ledgerId=${ledgerId}&status=VERIFIED`,
      )
      .set('Authorization', `Bearer ${token}`)
    expect(list.status).toBe(200)
    expect(list.body.data.releases).toHaveLength(1)
    expect(list.body.data.summary).toMatchObject({
      totalReleases: 1,
      totalAmount: 7500,
      verifiedAmount: 7500,
      pendingCount: 0,
    })

    const detail = await request(app)
      .get(
        `/api/v1/tenant/accounts/fund-releases/${list.body.data.releases[0].id}`,
      )
      .set('Authorization', `Bearer ${token}`)
    expect(detail.status).toBe(200)
    expect(detail.body.data.auditTrail[0].action).toBe('CREATE_AND_VERIFY')
  })

  it('changes status and records the audit trail', async () => {
    const updated = await request(app)
      .patch(`/api/v1/tenant/accounts/manager-ledgers/${ledgerId}/status`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'INACTIVE', reason: 'manager transferred' })

    expect(updated.status).toBe(200)
    expect(updated.body.data.status).toBe('INACTIVE')
    expect(updated.body.data.auditTrail[0]).toMatchObject({
      action: 'DEACTIVATE',
      remarks: 'Manager Transferred',
    })
  })
})
