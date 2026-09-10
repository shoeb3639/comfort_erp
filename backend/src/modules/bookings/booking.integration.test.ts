import { tenantBusinessDate } from '../../shared/date/tenant-business-date'
import { vehiclePerformance } from '../dashboard/vehicle-performance'
import { outstandingCustomers } from '../dashboard/outstanding-customers'
import { cardMetric, metricKeys } from '../dashboard/card-metrics'
import request from 'supertest'
import { app } from '../../app'
import { prisma } from '../../config/prisma'
import { hashPassword } from '../../shared/security/password'
import { TENANT_PERMISSIONS } from '../auth/auth.constants'
import * as bookingRepository from './booking.repository'

const password = 'Booking-Test!9Qv7#Secure'
let token: string
let tenantId: string
let customerId: string
let vehicleId: string
let driverId: string
let managerId: string

async function clean() {
  await prisma.bookingCashDeposit.deleteMany()
  await prisma.accountReference.deleteMany()
  await prisma.bookingCollection.deleteMany()
  await prisma.storedFile.deleteMany()
  await prisma.invoiceItem.deleteMany()
  await prisma.invoice.deleteMany()
  await prisma.invoiceSequence.deleteMany()
  await prisma.bookingClosure.deleteMany()
  await prisma.booking.deleteMany()
  await prisma.bookingSequence.deleteMany()
  await prisma.vehicle.deleteMany()
  await prisma.vehicleType.deleteMany()
  await prisma.driver.deleteMany()
  await prisma.vendor.deleteMany()
  await prisma.customerTraveller.deleteMany()
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
  await clean()
  const permissions = await Promise.all(
    TENANT_PERMISSIONS.map(([module, action]) =>
      prisma.permission.create({
        data: { module, action, permissionKey: `${module}.${action}` },
      }),
    ),
  )
  const plan = await prisma.subscriptionPlan.create({
    data: {
      code: 'BOOKING_TEST',
      name: 'Booking Test',
      billingCycle: 'MONTHLY',
      basePrice: 1000,
    },
  })
  const tenant = await prisma.tenant.create({
    data: {
      code: 'BOOKING_TENANT',
      legalName: 'Booking Tenant',
      email: 'booking@test.example.com',
      mobile: '9999999999',
      invoicePrefix: 'INV',
      status: 'ACTIVE',
    },
  })
  tenantId = tenant.id
  const role = await prisma.tenantRole.create({
    data: { tenantId, name: 'Booking Admin', code: 'ADMIN' },
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
      name: 'Booking User',
      email: 'booking-user@example.com',
      passwordHash: await hashPassword(password),
      status: 'ACTIVE',
    },
  })
  managerId = user.id
  await prisma.tenantSubscription.create({
    data: {
      tenantId,
      planId: plan.id,
      status: 'ACTIVE',
      billingCycle: 'MONTHLY',
      startsAt: new Date(Date.now() - 86400000),
      expiresAt: new Date(Date.now() + 30 * 86400000),
      amount: 1000,
      finalAmount: 1000,
      paymentStatus: 'PAID',
    },
  })
  const customer = await prisma.customer.create({
    data: {
      tenantId,
      customerCode: 'CUS-001',
      type: 'RETAIL',
      name: 'Test Customer',
      billingName: 'Test Customer',
      email: 'customer@example.com',
      phone: '9888888888',
      city: 'New Delhi',
      billingAddress: 'Test Address',
    },
  })
  customerId = customer.id
  const type = await prisma.vehicleType.create({
    data: { tenantId, name: 'Sedan' },
  })
  vehicleId = (
    await prisma.vehicle.create({
      data: {
        tenantId,
        ownershipType: 'OWN',
        vehicleCode: 'VEH-001',
        registrationNumber: 'DL01AA0001',
        vehicleTypeId: type.id,
      },
    })
  ).id
  driverId = (
    await prisma.driver.create({
      data: {
        tenantId,
        engagementType: 'OWN',
        driverCode: 'DRV-001',
        name: 'Test Driver',
        mobile: '9777777777',
      },
    })
  ).id
  const login = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: 'booking-user@example.com', password })
  token = login.body.data.accessToken as string
})

afterAll(async () => {
  await clean()
  await prisma.$disconnect()
})

function authorized(method: 'get' | 'post' | 'patch' | 'delete', path: string) {
  return request(app)[method](path).set('Authorization', `Bearer ${token}`)
}

function repositoryBookingData(
  targetTenantId: string,
  targetCustomerId: string,
) {
  return {
    tenantId: targetTenantId,
    customerId: targetCustomerId,
    bookingType: 'OUTSTATION' as const,
    bookingPackage: null,
    tripType: 'ONE_WAY' as const,
    serviceCity: 'New Delhi',
    startDate: new Date('2030-01-20'),
    endDate: new Date('2030-01-20'),
    pickupTime: '10:00',
    travellingFrom: 'New Delhi',
    travellingTo: 'Noida',
    pickupReportingAddress: 'Test pickup address',
    requestedVehicleType: 'Sedan',
    assignmentSource: 'OWN' as const,
    pricingBasis: 'FIXED' as const,
    customerRate: 1000,
    status: 'CONFIRMED' as const,
    confirmedAt: new Date(),
  }
}

describe('booking and duty assignment APIs', () => {
  it('allocates a daily booking number and assigns own duty resources', async () => {
    const created = await authorized('post', '/api/v1/tenant/bookings').send({
      customerId,
      bookingType: 'LOCAL',
      serviceCity: 'New Delhi',
      startDate: '2026-08-01',
      endDate: '2026-08-01',
      pickupTime: '10:00',
      travellingFrom: 'new delhi',
      travellingTo: 'gurugram',
      pickupReportingAddress: 'airport terminal two',
      requestedVehicleType: 'Sedan',
      assignmentSource: 'OWN',
      pricingBasis: 'FIXED',
      customerRate: 2500,
    })
    if (created.status !== 201)
      throw new Error(
        `Booking creation failed: ${JSON.stringify(created.body)}`,
      )
    expect(created.body.data.id).toMatch(/^\d{2}-\d{7,}$/)
    expect(created.body.data.travellingFrom).toBe('New Delhi')
    expect(created.body.data.travellingTo).toBe('Gurugram')
    expect(created.body.data.pickupReportingAddress).toBe(
      'Airport Terminal Two',
    )

    const updated = await authorized(
      'patch',
      `/api/v1/tenant/bookings/${created.body.data.id as string}`,
    ).send({
      travellingFrom: 'south delhi',
      travellingTo: 'cyber city',
      pickupReportingAddress: 'terminal three arrival gate',
      routeStops: 'dhaula kuan > aerocity',
      packageDetails: 'airport transfer package',
      requestedVehicleType: 'executive sedan',
      notes: 'meet at arrival gate',
    })
    expect(updated.status).toBe(200)
    expect(updated.body.data.travellingFrom).toBe('South Delhi')
    expect(updated.body.data.travellingTo).toBe('Cyber City')
    expect(updated.body.data.pickupReportingAddress).toBe(
      'Terminal Three Arrival Gate',
    )
    expect(updated.body.data.routeStops).toBe('Dhaula Kuan > Aerocity')
    expect(updated.body.data.packageDetails).toBe('Airport Transfer Package')
    expect(updated.body.data.requestedVehicleType).toBe('Executive Sedan')
    expect(updated.body.data.notes).toBe('Meet At Arrival Gate')

    const assigned = await authorized(
      'patch',
      `/api/v1/tenant/bookings/${created.body.data.id as string}/assignment`,
    ).send({
      assignmentSource: 'OWN',
      vendorId: null,
      vehicleId,
      driverId,
    })
    expect(assigned.status).toBe(200)
    expect(assigned.body.data.status).toBe('Assigned')
    expect(
      (await authorized('get', '/api/v1/tenant/bookings')).body.data.items,
    ).toHaveLength(1)

    const missingOpeningOdometer = await authorized(
      'patch',
      `/api/v1/tenant/bookings/${created.body.data.id as string}/duty/start`,
    ).send({})
    expect(missingOpeningOdometer.status).toBe(400)

    const started = await authorized(
      'patch',
      `/api/v1/tenant/bookings/${created.body.data.id as string}/duty/start`,
    ).send({ openingOdometer: 12500.5, remarks: 'driver reported on time' })
    expect(started.status).toBe(200)
    expect(started.body.data.status).toBe('In Transit')
    expect(started.body.data.openingOdometer).toBe(12500.5)
    expect(started.body.data.dutyStartRemarks).toBe('Driver Reported On Time')

    const invalidClosingOdometer = await authorized(
      'patch',
      `/api/v1/tenant/bookings/${created.body.data.id as string}/duty/complete`,
    ).send({ closingOdometer: 12499 })
    expect(invalidClosingOdometer.status).toBe(400)

    const completed = await authorized(
      'patch',
      `/api/v1/tenant/bookings/${created.body.data.id as string}/duty/complete`,
    ).send({
      closingOdometer: 12620.75,
      tollTax: 150,
      parking: 50,
      driverAllowance: 300,
      otherRecoverableCharges: 100,
      remarks: 'guest dropped successfully',
    })
    expect(completed.status).toBe(200)
    expect(completed.body.data.status).toBe('Completed')
    expect(completed.body.data.actualDistance).toBe(120.25)
    expect(completed.body.data.dutyCompletionRemarks).toBe(
      'Guest Dropped Successfully',
    )
    expect(completed.body.data.dutyCompletionDetails).toMatchObject({
      tollTax: 150,
      parking: 50,
      driverAllowance: 300,
      otherRecoverableCharges: 100,
    })

    const cancelCompleted = await authorized(
      'patch',
      `/api/v1/tenant/bookings/${created.body.data.id as string}/cancel`,
    ).send({ reason: 'should not be accepted' })
    expect(cancelCompleted.status).toBe(409)

    const closed = await authorized(
      'post',
      `/api/v1/tenant/bookings/${created.body.data.id as string}/close`,
    ).send({
      billingTripType: 'PACKAGE_BASED',
      closingDate: '2026-08-01',
      closingTime: '18:00',
      startKm: 12500.5,
      endKm: 12620.75,
      packageAmount: 2500,
      tollTax: 150,
      parking: 50,
      driverAllowance: 300,
      otherRecoverableCharges: 100,
      dieselCost: 700,
      directVehicleExpense: 100,
      driverCost: 250,
      remarks: 'trip closed after document review',
    })
    expect(closed.status).toBe(200)
    expect(closed.body.data.status).toBe('Closed')
    expect(closed.body.data.closeDetails.totalBillAmount).toBe(3100)
    expect(closed.body.data.closeDetails.netVehicleProfit).toBe(1450)
    expect(closed.body.data.invoice.invoiceStatus).toBe('Draft')

    const profit = await authorized(
      'get',
      `/api/v1/tenant/bookings/${created.body.data.id as string}/profit`,
    )
    expect(profit.status).toBe(200)
    expect(profit.body.data.closeDetails.vehicleRevenue).toBe(2500)

    const invoices = await authorized('get', '/api/v1/tenant/invoices')
    expect(invoices.status).toBe(200)
    expect(invoices.body.data.items).toHaveLength(1)
    const invoiceId = invoices.body.data.items[0].id as string

    const generated = await authorized(
      'patch',
      `/api/v1/tenant/invoices/${invoiceId}/generate`,
    ).send({})
    expect(generated.status).toBe(200)
    expect(generated.body.data.invoiceStatus).toBe('Generated')
    expect(generated.body.data.invoiceNumber).toMatch(
      /^INV\/\d{2}-\d{2}\/\d{6}$/,
    )

    const collection = await authorized(
      'post',
      `/api/v1/tenant/bookings/${created.body.data.id as string}/collections`,
    ).send({
      collectionDate: '2026-08-02',
      amount: 1000,
      paymentMode: 'CASH',
      collectedBy: 'Driver',
      receiverName: 'Operations Manager',
      depositStatus: 'DEPOSITED',
      depositDate: '2026-08-02',
      depositMode: 'Cash Deposit',
      depositReferenceNumber: 'DEP-1001',
    })
    expect(collection.status).toBe(201)
    expect(collection.body.data.collectionSummary.totalCollected).toBe(1000)
    const collectionId = collection.body.data.collections[0].id as string

    const duplicateReference = await authorized(
      'post',
      `/api/v1/tenant/bookings/${created.body.data.id as string}/collections`,
    ).send({
      collectionDate: '2026-08-02',
      amount: 100,
      paymentMode: 'BANK_TRANSFER',
      collectedBy: 'Office',
      referenceNumber: 'dep-1001',
    })
    expect(duplicateReference.status).toBe(409)
    expect(duplicateReference.body.code).toBe('DUPLICATE_REFERENCE')

    const collectionRegister = await authorized(
      'get',
      `/api/v1/tenant/accounts/collections?paymentMode=CASH&customerId=${customerId}&dateFrom=2026-08-01&dateTo=2026-08-03`,
    )
    expect(collectionRegister.status).toBe(200)
    expect(collectionRegister.body.data.collections).toHaveLength(1)
    expect(collectionRegister.body.data.summary).toMatchObject({
      totalBilled: 3100,
      totalCollected: 1000,
      outstandingBalance: 2100,
      partiallyPaidBookings: 1,
    })

    const collectionReceipt = await authorized(
      'get',
      `/api/v1/tenant/accounts/collections/${collectionId}`,
    )
    expect(collectionReceipt.status).toBe(200)
    expect(collectionReceipt.body.data.receiptNumber).toMatch(/^COL-2026-/)
    expect(collectionReceipt.body.data.auditTrail[0].action).toBe('CREATE')

    const pendingCashCollection = await authorized(
      'post',
      `/api/v1/tenant/bookings/${created.body.data.id as string}/collections`,
    ).send({
      collectionDate: '2026-08-02',
      amount: 500,
      paymentMode: 'CASH',
      collectedBy: 'Driver',
      depositStatus: 'PENDING',
    })
    expect(pendingCashCollection.status).toBe(201)

    const cashRegister = await authorized(
      'get',
      '/api/v1/tenant/accounts/cash-deposits?dateFrom=2026-08-01&dateTo=2026-08-03',
    )
    expect(cashRegister.status).toBe(200)
    expect(cashRegister.body.data.deposits).toHaveLength(2)
    expect(cashRegister.body.data.policies).toEqual({
      customerCashAffectsManagerLedger: false,
      depositedAmountCannotExceedCollectedCash: true,
    })
    const pendingDeposit = (
      cashRegister.body.data.deposits as Array<{
        id: string
        status: string
      }>
    ).find((deposit) => deposit.status === 'COLLECTED')
    expect(pendingDeposit).toBeDefined()

    const receivedCash = await authorized(
      'patch',
      `/api/v1/tenant/accounts/cash-deposits/${pendingDeposit!.id}/receive`,
    ).send({ managerId, remarks: 'cash handed to operations manager' })
    expect(receivedCash.status).toBe(200)
    expect(receivedCash.body.data.status).toBe('WITH_MANAGER')
    expect(receivedCash.body.data.receiverManager.id).toBe(managerId)

    const excessiveDeposit = await authorized(
      'patch',
      `/api/v1/tenant/accounts/cash-deposits/${pendingDeposit!.id}/deposit`,
    ).send({
      depositedAmount: 501,
      depositDate: '2026-08-03',
      depositMode: 'CASH_DEPOSIT',
      bankReference: 'BANK-OVER-501',
      depositedBy: 'Accounts Manager',
    })
    expect(excessiveDeposit.status).toBe(409)
    expect(excessiveDeposit.body.code).toBe('DEPOSIT_EXCEEDS_CASH')

    const depositedCash = await authorized(
      'patch',
      `/api/v1/tenant/accounts/cash-deposits/${pendingDeposit!.id}/deposit`,
    ).send({
      depositedAmount: 500,
      depositDate: '2026-08-03',
      depositMode: 'CASH_DEPOSIT',
      bankReference: 'BANK-DEP-500',
      attachmentName: 'deposit-slip.pdf',
      depositedBy: 'Accounts Manager',
    })
    expect(depositedCash.status).toBe(200)
    expect(depositedCash.body.data.status).toBe('DEPOSITED')
    expect(depositedCash.body.data.bankReference).toBe('BANK-DEP-500')

    const verifiedCash = await authorized(
      'patch',
      `/api/v1/tenant/accounts/cash-deposits/${pendingDeposit!.id}/verify`,
    ).send({
      verifiedAmount: 500,
      verifiedBy: 'Accounts Manager',
    })
    expect(verifiedCash.status).toBe(200)
    expect(verifiedCash.body.data.status).toBe('VERIFIED')
    expect(verifiedCash.body.data.auditTrail[0].action).toBe('VERIFY')

    const mismatchCollection = await authorized(
      'post',
      `/api/v1/tenant/bookings/${created.body.data.id as string}/collections`,
    ).send({
      collectionDate: '2026-08-02',
      amount: 200,
      paymentMode: 'CASH',
      collectedBy: 'Office',
      depositStatus: 'PENDING',
    })
    expect(mismatchCollection.status).toBe(201)
    const collectedDeposits = await authorized(
      'get',
      '/api/v1/tenant/accounts/cash-deposits?status=COLLECTED',
    )
    const mismatchDepositId = collectedDeposits.body.data.deposits[0]
      .id as string
    const partialDeposit = await authorized(
      'patch',
      `/api/v1/tenant/accounts/cash-deposits/${mismatchDepositId}/deposit`,
    ).send({
      depositedAmount: 150,
      depositDate: '2026-08-03',
      depositMode: 'CASH_DEPOSIT',
      bankReference: 'BANK-PARTIAL-150',
      depositedBy: 'Accounts Manager',
    })
    expect(partialDeposit.status).toBe(200)
    const mismatchVerification = await authorized(
      'patch',
      `/api/v1/tenant/accounts/cash-deposits/${mismatchDepositId}/verify`,
    ).send({
      verifiedAmount: 150,
      verifiedBy: 'Accounts Manager',
      mismatchReason: 'Bank deposit is short by fifty rupees',
    })
    expect(mismatchVerification.status).toBe(200)
    expect(mismatchVerification.body.data.status).toBe('MISMATCH')
    expect(mismatchVerification.body.data.mismatchAmount).toBe(50)
    expect(mismatchVerification.body.data.auditTrail[0].action).toBe('MISMATCH')

    const excessiveCollection = await authorized(
      'post',
      `/api/v1/tenant/bookings/${created.body.data.id as string}/collections`,
    ).send({
      collectionDate: '2026-08-02',
      amount: 2200,
      paymentMode: 'UPI',
      collectedBy: 'Office',
    })
    expect(excessiveCollection.status).toBe(409)

    const verified = await authorized(
      'patch',
      `/api/v1/tenant/bookings/${created.body.data.id as string}/collections/${collectionId}/verify`,
    ).send({ verifiedBy: 'Accounts Manager' })
    expect(verified.status).toBe(200)
    expect(verified.body.data.collections[0].depositStatus).toBe('Verified')

    const verifiedReceipt = await authorized(
      'get',
      `/api/v1/tenant/accounts/collections/${collectionId}`,
    )
    expect(verifiedReceipt.body.data.auditTrail[0].action).toBe('VERIFY')

    const voided = await authorized(
      'delete',
      `/api/v1/tenant/bookings/${created.body.data.id as string}/collections/${collectionId}`,
    )
    expect(voided.status).toBe(200)
    expect(voided.body.data.collections).toHaveLength(2)

    const voidReceipt = await authorized(
      'get',
      `/api/v1/tenant/accounts/collections/${collectionId}`,
    )
    expect(voidReceipt.body.data.status).toBe('VOID')
    expect(voidReceipt.body.data.auditTrail[0].action).toBe('VOID')

    const draft = await authorized('post', '/api/v1/tenant/bookings').send({
      customerId,
      bookingType: 'LOCAL',
      serviceCity: 'New Delhi',
      startDate: '2026-08-03',
      endDate: '2026-08-03',
      pickupTime: '11:00',
      travellingFrom: 'new delhi',
      travellingTo: 'noida',
      pickupReportingAddress: 'test pickup address',
      requestedVehicleType: 'Sedan',
      assignmentSource: 'OWN',
      pricingBasis: 'FIXED',
      customerRate: 1800,
      status: 'DRAFT',
    })
    expect(draft.status).toBe(201)
    expect(draft.body.data.status).toBe('Draft')
    expect(draft.body.data.bookingNumber).toBeNull()

    const confirmed = await authorized(
      'patch',
      `/api/v1/tenant/bookings/${draft.body.data.id as string}/confirm`,
    ).send({})
    expect(confirmed.status).toBe(200)
    expect(confirmed.body.data.status).toBe('Confirmed')
    expect(confirmed.body.data.id).toMatch(/^\d{2}-\d{7,}$/)
    const confirmedNumber = confirmed.body.data.id as string

    const confirmedAgain = await authorized(
      'patch',
      `/api/v1/tenant/bookings/${draft.body.data.databaseId as string}/confirm`,
    ).send({})
    expect(confirmedAgain.status).toBe(200)
    expect(confirmedAgain.body.data.id).toBe(confirmedNumber)

    const cancelled = await authorized(
      'patch',
      `/api/v1/tenant/bookings/${draft.body.data.id as string}/cancel`,
    ).send({ reason: 'customer changed travel plan' })
    expect(cancelled.status).toBe(200)
    expect(cancelled.body.data.status).toBe('Cancelled')
    expect(cancelled.body.data.cancellationReason).toBe(
      'Customer Changed Travel Plan',
    )
  })

  it('allocates unique numbers under concurrent confirmed booking creation', async () => {
    const responses = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        authorized('post', '/api/v1/tenant/bookings').send({
          customerId,
          bookingType: 'LOCAL',
          serviceCity: 'New Delhi',
          startDate: '2026-09-20',
          endDate: '2026-09-20',
          pickupTime: '12:00',
          travellingFrom: 'new delhi',
          travellingTo: `destination ${index}`,
          pickupReportingAddress: 'test pickup address',
          requestedVehicleType: 'Sedan',
          assignmentSource: 'OWN',
          pricingBasis: 'FIXED',
          customerRate: 1000 + index,
        }),
      ),
    )
    expect(responses.every((response) => response.status === 201)).toBe(true)
    const numbers = responses.map((response) => response.body.data.id as string)
    expect(new Set(numbers).size).toBe(10)
    expect(numbers.every((number) => /^\d{2}-\d{7,}$/.test(number))).toBe(true)
  })

  it('rolls back sequence allocation when the booking transaction fails', async () => {
    const bookingDate = '2030-01-01'
    await expect(
      bookingRepository.create(
        repositoryBookingData(tenantId, customerId),
        bookingDate,
        '00000000-0000-4000-8000-000000000099',
      ),
    ).rejects.toBeDefined()
    expect(
      await prisma.bookingSequence.findUnique({
        where: {
          tenantId_bookingDate: {
            tenantId,
            bookingDate: new Date(`${bookingDate}T00:00:00.000Z`),
          },
        },
      }),
    ).toBeNull()
  })

  it('keeps daily sequences independent across tenants and dates', async () => {
    const secondTenant = await prisma.tenant.create({
      data: {
        code: 'BOOKING_TENANT_TWO',
        legalName: 'Booking Tenant Two',
        email: 'booking-two@test.example.com',
        mobile: '9999999998',
        status: 'ACTIVE',
      },
    })
    const secondRole = await prisma.tenantRole.create({
      data: { tenantId: secondTenant.id, name: 'Admin', code: 'ADMIN' },
    })
    const secondUser = await prisma.tenantUser.create({
      data: {
        tenantId: secondTenant.id,
        roleId: secondRole.id,
        name: 'Second User',
        email: 'booking-user-two@example.com',
        passwordHash: await hashPassword(password),
        status: 'ACTIVE',
      },
    })
    const secondCustomer = await prisma.customer.create({
      data: {
        tenantId: secondTenant.id,
        customerCode: 'CUS-001',
        type: 'RETAIL',
        name: 'Second Customer',
        billingName: 'Second Customer',
        phone: '9888888887',
        billingAddress: 'Test Address',
      },
    })
    const firstTenantBooking = await bookingRepository.create(
      repositoryBookingData(tenantId, customerId),
      '2030-01-02',
      managerId,
    )
    const secondTenantBooking = await bookingRepository.create(
      repositoryBookingData(secondTenant.id, secondCustomer.id),
      '2030-01-02',
      secondUser.id,
    )
    const nextDayBooking = await bookingRepository.create(
      repositoryBookingData(tenantId, customerId),
      '2030-01-03',
      managerId,
    )
    expect(firstTenantBooking.bookingNumber).toBe('30-0102001')
    expect(secondTenantBooking.bookingNumber).toBe('30-0102001')
    expect(nextDayBooking.bookingNumber).toBe('30-0103001')
  })
})

describe('driver customer-payment settlement', () => {
  it.each(['CASH', 'UPI', 'VENDOR_UPI'])(
    'tracks fuel proof, driver balance and returns for %s',
    async (scenario) => {
      const isVendor = scenario === 'VENDOR_UPI'
      const paymentMode = scenario === 'CASH' ? 'CASH' : 'UPI'
      const user = await prisma.tenantUser.findFirstOrThrow({
        where: { tenantId },
      })
      const vendor = isVendor
        ? await prisma.vendor.create({
            data: {
              tenantId,
              vendorCode: 'FUEL-VENDOR',
              name: 'Fuel Vendor',
              recordType: 'COMPANY',
              category: 'Transport',
              phone: '9999999900',
              city: 'New Delhi',
            },
          })
        : null
      const booking = await bookingRepository.create(
        {
          ...repositoryBookingData(tenantId, customerId),
          driverId,
          vehicleId,
          customerRate: 10000,
          assignmentSource: isVendor ? 'VENDOR' : 'OWN',
          vendorPayableAmount: isVendor ? 9000 : 0,
          vendorId: vendor?.id ?? null,
        },
        '2026-08-03',
        user.id,
      )
      const closePath = `/api/v1/tenant/bookings/${booking.id}/close`
      const closing = {
        billingTripType: 'PACKAGE_BASED',
        packageAmount: 10000,
        paymentAmount: 3000,
        paymentMode,
        paymentDate: '2026-08-03',
        paymentHolder: 'DRIVER',
        collectedBy: 'Test Driver',
        dieselCost: 2500,
        fuelConsumedLitres: 25,
        fuelAmount: 2500,
        vendorDeduction: isVendor ? 2500 : 0,
        vendorPayableAmount: isVendor ? 9000 : 0,
      }
      const missingProof = await authorized('post', closePath).send(closing)
      expect(missingProof.status).toBe(400)
      expect(missingProof.body.code).toBe('FUEL_RECEIPT_REQUIRED')

      const uploaded = await authorized('post', '/api/v1/tenant/files')
        .field('entityType', 'BOOKING')
        .field('entityId', booking.id)
        .field('documentType', 'FUEL_RECEIPT')
        .attach('file', Buffer.from('%PDF-1.4\nfuel receipt'), {
          filename: 'fuel.pdf',
          contentType: 'application/pdf',
        })
      expect(uploaded.status).toBe(201)
      const receiptId = uploaded.body.data.id as string
      const invalidReceipt = await authorized('post', closePath).send({
        ...closing,
        fuelReceiptId: booking.id,
      })
      expect(invalidReceipt.body.code).toBe('INVALID_FUEL_RECEIPT')
      const previousPerformance = (
        await vehiclePerformance(tenantId, 'OWN', '1900-01-01', '2100-12-31')
      ).items.find((item) => item.id === vehicleId)
      const beforeCollected = await cardMetric(
        tenantId,
        'collections',
        '2026-08-03',
        '2026-08-03',
      )
      const beforeExpenses = await cardMetric(
        tenantId,
        'expenses',
        '2026-08-03',
        '2026-08-03',
      )
      const closed = await authorized('post', closePath).send({
        ...closing,
        fuelReceiptId: receiptId,
      })
      expect(closed.status).toBe(200)
      const performance = (
        await vehiclePerformance(tenantId, 'OWN', '1900-01-01', '2100-12-31')
      ).items.find((item) => item.id === vehicleId)!
      expect(performance.revenue - (previousPerformance?.revenue ?? 0)).toBe(
        10000,
      )
      expect(performance.fuelCost - (previousPerformance?.fuelCost ?? 0)).toBe(
        2500,
      )
      expect(
        performance.netProfit - (previousPerformance?.netProfit ?? 0),
      ).toBe(isVendor ? 1000 : 7500)

      expect(
        (await cardMetric(tenantId, 'collections', '2026-08-03', '2026-08-03'))
          .value - beforeCollected.value,
      ).toBe(3000)
      expect(
        (await cardMetric(tenantId, 'expenses', '2026-08-03', '2026-08-03'))
          .value - beforeExpenses.value,
      ).toBe(2500)
      if (scenario === 'CASH')
        expect(
          (await cardMetric(tenantId, 'cash', '2026-08-03', '2026-08-03'))
            .value,
        ).toBe(500)

      const closure = await prisma.bookingClosure.findUniqueOrThrow({
        where: { bookingId: booking.id },
      })
      expect(Number(closure.fuelConsumedLitres)).toBe(25)
      const invoiceList = await authorized(
        'get',
        '/api/v1/tenant/invoices?limit=100',
      )
      expect(invoiceList.status).toBe(200)
      const paidInvoice = (
        invoiceList.body.data.items as Array<{
          bookingRecordId: string
          totalCollected: number
          pendingBalance: number
        }>
      ).find(
        (item: { bookingRecordId: string }) =>
          item.bookingRecordId === booking.id,
      )
      expect(paidInvoice).toMatchObject({
        totalCollected: 3000,
        pendingBalance: 7000,
      })
      expect(closed.body.data.collectionSummary).toMatchObject({
        totalCollected: 3000,
        pendingBalance: 7000,
        cashPendingDeposit: 0,
      })
      expect(closed.body.data.closeDetails.netVehicleProfit).toBe(
        isVendor ? 0 : 7500,
      )
      if (isVendor)
        expect(closed.body.data.closeDetails).toMatchObject({
          finalVendorPayable: 6500,
          vendorBookingProfit: 1000,
          dieselCost: 2500,
        })
      const collection = closed.body.data.collections[0]
      expect(collection).toMatchObject({
        paymentHolder: 'DRIVER',
        fuelAmount: 2500,
        returnedAmount: 0,
        driverBalance: 500,
        depositStatus: 'Pending',
      })
      expect(
        await prisma.bookingCashDeposit.count({
          where: { collectionId: collection.id },
        }),
      ).toBe(0)
      const verifyPath = `/api/v1/tenant/bookings/${booking.id}/collections/${collection.id}/verify`
      const driverLedgerPath = `/api/v1/tenant/drivers/${driverId}/ledger`
      const driverLedgerBefore = await authorized('get', driverLedgerPath)
      expect(driverLedgerBefore.status).toBe(200)
      expect(driverLedgerBefore.body.data.summary.heldByDriver).toBe(500)
      expect(driverLedgerBefore.body.data.collections).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: collection.id,
            driverBalance: 500,
            fuelAmount: 2500,
          }),
        ]),
      )
      const auditBefore = await authorized(
        'get',
        '/api/v1/tenant/accounts/audit',
      )
      expect(auditBefore.body.data.exceptions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            key: `DRIVER:${collection.id}`,
            amount: 500,
            status: 'OPEN',
          }),
        ]),
      )
      const premature = await authorized('patch', verifyPath).send({})
      expect(premature.body.code).toBe('DRIVER_BALANCE_PENDING')
      const deletedReceipt = await authorized(
        'delete',
        `/api/v1/tenant/files/${receiptId}`,
      )
      expect(deletedReceipt.status).toBe(409)
      expect(
        (await authorized('get', `/api/v1/tenant/files/${receiptId}/download`))
          .status,
      ).toBe(200)

      const returnPath = `/api/v1/tenant/accounts/collections/${collection.id}/driver-returns`
      const returnData = {
        amount: 200,
        paymentMode: 'CASH',
        returnDate: '2026-08-04',
        referenceNumber: `${scenario}-RETURN-ONE`,
      }
      const returned = await authorized('post', returnPath).send(returnData)
      expect(returned.status).toBe(200)
      expect(returned.body.data).toMatchObject({
        amount: 3000,
        returnedAmount: 200,
        driverBalance: 300,
      })
      expect(
        (await authorized('get', driverLedgerPath)).body.data.summary
          .heldByDriver,
      ).toBe(300)
      const duplicate = await authorized('post', returnPath).send(returnData)
      expect(duplicate.status).toBe(409)
      expect(duplicate.body.code).toBe('DUPLICATE_REFERENCE')
      const over = await authorized('post', returnPath).send({
        ...returnData,
        amount: 301,
        referenceNumber: `${paymentMode}-OVER`,
      })
      expect(over.body.code).toBe('RETURN_EXCEEDS_BALANCE')

      // Concurrent attempts cannot receive the same remaining balance twice.
      const results = await Promise.all(
        [1, 2].map((index) =>
          authorized('post', returnPath).send({
            ...returnData,
            amount: 300,
            paymentMode: 'UPI',
            referenceNumber: `${scenario}-RETURN-${index + 1}`,
          }),
        ),
      )
      expect(results.map((row) => row.status).sort()).toEqual([200, 409])
      const verified = await authorized('patch', verifyPath).send({
        verifiedBy: 'Accounts Reviewer',
      })
      expect(verified.status).toBe(200)
      const detail = await authorized(
        'get',
        `/api/v1/tenant/accounts/collections/${collection.id}`,
      )
      expect(detail.body.data).toMatchObject({
        amount: 3000,
        fuelAmount: 2500,
        returnedAmount: 500,
        driverBalance: 0,
        status: 'VERIFIED',
      })
      const driverLedgerAfter = await authorized('get', driverLedgerPath)
      expect(driverLedgerAfter.body.data.summary.heldByDriver).toBe(0)
      expect(driverLedgerAfter.body.data.collections).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: collection.id,
            amount: 3000,
            returnedAmount: 500,
            driverBalance: 0,
          }),
        ]),
      )
      const auditAfter = await authorized(
        'get',
        '/api/v1/tenant/accounts/audit',
      )
      expect(auditAfter.body.data.exceptions).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ key: `DRIVER:${collection.id}` }),
        ]),
      )
      expect(
        (detail.body.data.auditTrail as Array<{ action: string }>).filter(
          (row: { action: string }) => row.action === 'DRIVER_RETURN',
        ),
      ).toHaveLength(2)
      expect(
        (
          await authorized(
            'delete',
            `/api/v1/tenant/bookings/${booking.id}/collections/${collection.id}`,
          )
        ).body.code,
      ).toBe('DRIVER_SETTLEMENT_EXISTS')
      const register = await authorized(
        'get',
        `/api/v1/tenant/accounts/collections?booking=${booking.bookingNumber}`,
      )
      expect(register.body.data.summary).toMatchObject({
        totalBilled: 10000,
        totalCollected: 3000,
        outstandingBalance: 7000,
        fuelFromCollections: 2500,
        driverReturns: 500,
        driverBalance: 0,
      })
      expect(register.body.data.driverSummaries[0]).toMatchObject({
        collected: 3000,
        fuel: 2500,
        returned: 500,
        balance: 0,
      })
    },
  )
})

describe('independent dashboard card filters', () => {
  it('supports every metric and validates dates and metric names', async () => {
    for (const metric of metricKeys) {
      const response = await authorized(
        'get',
        `/api/v1/tenant/dashboard/card?metric=${metric}&start=2026-01-01&end=2026-12-31`,
      )
      expect(response.status).toBe(200)
      expect(typeof response.body.data.value).toBe('number')
    }
    for (const query of [
      'metric=unknown&start=2026-01-01&end=2026-01-02',
      'metric=bookings&start=2026-02-30&end=2026-03-01',
      'metric=bookings&start=2026-03-02&end=2026-03-01',
    ]) {
      expect(
        (await authorized('get', `/api/v1/tenant/dashboard/card?${query}`))
          .status,
      ).toBe(400)
    }
  })
  it('aggregates over 100 bookings with inclusive boundaries and tenant isolation', async () => {
    await prisma.booking.createMany({
      data: Array.from({ length: 105 }, (_, index) => ({
        ...repositoryBookingData(tenantId, customerId),
        bookingNumber: `41-0401${String(index + 1).padStart(3, '0')}`,
        startDate: new Date('2041-04-01'),
        endDate: new Date('2041-04-01'),
      })),
    })
    expect(
      (await cardMetric(tenantId, 'bookings', '2041-04-01', '2041-04-01'))
        .value,
    ).toBe(105)
    expect(
      (await cardMetric(tenantId, 'bookings', '2041-04-02', '2041-04-02'))
        .value,
    ).toBe(0)
    const otherTenant = await prisma.tenant.findFirstOrThrow({
      where: { id: { not: tenantId } },
    })
    expect(
      (await cardMetric(otherTenant.id, 'bookings', '2041-04-01', '2041-04-01'))
        .value,
    ).toBe(0)
  })
  it('carries older unpaid invoices forward and excludes future payments from earlier balances', async () => {
    const user = await prisma.tenantUser.findFirstOrThrow({
      where: { tenantId },
    })
    const before = await cardMetric(
      tenantId,
      'pending',
      '2042-05-01',
      '2042-05-01',
    )
    const beforeLater = await cardMetric(
      tenantId,
      'pending',
      '2042-05-02',
      '2042-05-02',
    )
    const booking = await bookingRepository.create(
      repositoryBookingData(tenantId, customerId),
      '2042-04-01',
      user.id,
    )
    const closed = await authorized(
      'post',
      `/api/v1/tenant/bookings/${booking.id}/close`,
    ).send({ billingTripType: 'PACKAGE_BASED', packageAmount: 1000 })
    expect(closed.status).toBe(200)
    const invoice = await prisma.invoice.findFirstOrThrow({
      where: { tenantId, bookingId: booking.id },
    })
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: { invoiceDate: new Date('2042-04-01') },
    })
    await prisma.bookingCollection.createMany({
      data: [
        {
          tenantId,
          bookingId: booking.id,
          invoiceId: invoice.id,
          collectionDate: new Date('2042-04-15'),
          amount: 400,
          paymentMode: 'UPI',
          collectedByName: 'Accounts',
          status: 'DIRECTLY_RECEIVED',
          recordedById: user.id,
        },
        {
          tenantId,
          bookingId: booking.id,
          invoiceId: invoice.id,
          collectionDate: new Date('2042-05-02'),
          amount: 600,
          paymentMode: 'UPI',
          collectedByName: 'Accounts',
          status: 'DIRECTLY_RECEIVED',
          recordedById: user.id,
        },
      ],
    })
    expect(
      (await cardMetric(tenantId, 'pending', '2042-05-01', '2042-05-01'))
        .value - before.value,
    ).toBe(600)
    expect(
      (await cardMetric(tenantId, 'pending', '2042-05-02', '2042-05-02'))
        .value - beforeLater.value,
    ).toBe(0)
  })

  it('requires report permission', async () => {
    const user = await prisma.tenantUser.findFirstOrThrow({
      where: { tenantId, email: 'booking-user@example.com' },
    })
    const permission = await prisma.permission.findUniqueOrThrow({
      where: { permissionKey: 'reports.view' },
    })
    const grant = await prisma.tenantRolePermission.findFirstOrThrow({
      where: { tenantId, roleId: user.roleId, permissionId: permission.id },
    })
    await prisma.tenantRolePermission.delete({ where: { id: grant.id } })
    try {
      expect(
        (
          await authorized(
            'get',
            '/api/v1/tenant/dashboard/card?metric=bookings&start=2026-01-01&end=2026-01-01',
          )
        ).status,
      ).toBe(403)
    } finally {
      await prisma.tenantRolePermission.create({ data: grant })
    }
  })
})

describe('outstanding customer rankings', () => {
  it('ranks the top five customers per type and totals all customers after payments', async () => {
    const user = await prisma.tenantUser.findFirstOrThrow({
      where: { tenantId },
    })
    const before = await outstandingCustomers(tenantId, '2044-05-01')
    const baseline = before.groups.find(
      (group) => group.type === 'TRAVEL_AGENT',
    )!.total
    const ids: string[] = []
    for (let index = 0; index < 6; index++) {
      const customer = await prisma.customer.create({
        data: {
          tenantId,
          customerCode: `TOP-${index}`,
          type: 'TRAVEL_AGENT',
          name: `Top customer ${index}`,
          billingName: `Top customer ${index}`,
          phone: '9999999911',
          billingAddress: 'Test address',
        },
      })
      ids.push(customer.id)
      for (const amount of index === 0 ? [1000, 10000] : [(index + 1) * 1000]) {
        const booking = await bookingRepository.create(
          repositoryBookingData(tenantId, customer.id),
          '2044-04-01',
          user.id,
        )
        const response = await authorized(
          'post',
          `/api/v1/tenant/bookings/${booking.id}/close`,
        ).send({ billingTripType: 'PACKAGE_BASED', packageAmount: amount })
        expect(response.status).toBe(200)
        const invoice = await prisma.invoice.findFirstOrThrow({
          where: { tenantId, bookingId: booking.id },
        })
        await prisma.invoice.update({
          where: { id: invoice.id },
          data: { invoiceDate: new Date('2044-04-01') },
        })
        if (index === 1)
          await prisma.bookingCollection.create({
            data: {
              tenantId,
              bookingId: booking.id,
              invoiceId: invoice.id,
              collectionDate: new Date('2044-04-15'),
              amount: 1000,
              paymentMode: 'UPI',
              collectedByName: 'Accounts',
              status: 'DIRECTLY_RECEIVED',
              recordedById: user.id,
            },
          })
      }
    }
    const result = await outstandingCustomers(tenantId, '2044-05-01')
    const group = result.groups.find((item) => item.type === 'TRAVEL_AGENT')!
    expect(group.total - baseline).toBe(30000)
    expect(group.customers).toHaveLength(5)
    expect(group.customers.map((customer) => customer.amount)).toEqual([
      11000, 6000, 5000, 4000, 3000,
    ])
    expect(group.customers[0]!.id).toBe(ids[0])
    expect(
      result.groups
        .filter((item) => item.type !== 'TRAVEL_AGENT')
        .flatMap((item) => item.customers)
        .some((customer) => ids.includes(customer.id)),
    ).toBe(false)
    const response = await authorized(
      'get',
      '/api/v1/tenant/dashboard/outstanding-customers?date=2044-05-01',
    )
    expect(response.status).toBe(200)
    expect(response.body.data.asOf).toBe('2044-05-01')
    expect(
      (
        await authorized(
          'get',
          '/api/v1/tenant/dashboard/outstanding-customers?date=2044-02-30',
        )
      ).status,
    ).toBe(400)
    const otherTenant = await prisma.tenant.findFirstOrThrow({
      where: { id: { not: tenantId } },
    })
    expect(
      (await outstandingCustomers(otherTenant.id, '2044-05-01')).groups
        .flatMap((item) => item.customers)
        .some((customer) => ids.includes(customer.id)),
    ).toBe(false)
  })
})

describe('finalized vehicle performance', () => {
  it('uses total kilometre billing less excluded charges and recorded costs', async () => {
    const user = await prisma.tenantUser.findFirstOrThrow({
      where: { tenantId },
    })
    const existingVehicle = await prisma.vehicle.findUniqueOrThrow({
      where: { id: vehicleId },
    })
    const vehicle = await prisma.vehicle.create({
      data: {
        tenantId,
        ownershipType: 'OWN',
        vehicleCode: 'PERF-TEST',
        registrationNumber: 'PERF-TEST',
        vehicleTypeId: existingVehicle.vehicleTypeId,
      },
    })
    const booking = await bookingRepository.create(
      {
        ...repositoryBookingData(tenantId, customerId),
        vehicleId: vehicle.id,
        pricingBasis: 'RATE_PER_KM',
        customerRate: 20,
      },
      '2045-01-01',
      user.id,
    )
    const response = await authorized(
      'post',
      `/api/v1/tenant/bookings/${booking.id}/close`,
    ).send({
      billingTripType: 'KM_BASED',
      startKm: 100,
      endKm: 300,
      ratePerKm: 20,
      tollTax: 100,
      parking: 50,
      driverAllowance: 200,
      otherRecoverableCharges: 50,
      gst: 100,
      dieselCost: 1000,
      directVehicleExpense: 200,
      driverCost: 500,
      allocatedOfficeExpense: 100,
    })
    expect(response.status).toBe(200)
    const api = await authorized(
      'get',
      '/api/v1/tenant/dashboard/vehicle-performance',
    )
    expect(api.status).toBe(200)
    const report = await vehiclePerformance(
      tenantId,
      'OWN',
      '1900-01-01',
      '2100-12-31',
    )
    const row = report.items.find((item) => item.id === vehicle.id)!
    expect(row).toMatchObject({
      revenue: 4150,
      fuelCost: 1000,
      maintenance: 200,
      driverCost: 500,
      otherCost: 100,
      netProfit: 2350,
      profitPercent: 56.63,
    })
    const dated = await vehiclePerformance(
      tenantId,
      'OWN',
      '2030-01-20',
      '2030-01-20',
    )
    expect(dated.items.find((item) => item.id === vehicle.id)).toEqual(row)
    expect(
      (
        await vehiclePerformance(tenantId, 'OWN', '2030-01-21', '2030-01-31')
      ).items.some((item) => item.id === vehicle.id),
    ).toBe(false)
    const tenant = await prisma.tenant.findUniqueOrThrow({
      where: { id: tenantId },
    })
    const today = tenantBusinessDate(tenant.timeZone)
    const defaults = await vehiclePerformance(tenantId)
    expect(defaults).toMatchObject({
      ownership: 'OWN',
      start: `${today.slice(0, 7)}-01`,
      end: today,
    })
    const invalid = await authorized(
      'get',
      '/api/v1/tenant/dashboard/vehicle-performance?start=2030-02-30&end=2030-03-01',
    )
    expect(invalid.status).toBe(400)
    expect(
      (
        await authorized(
          'get',
          '/api/v1/tenant/dashboard/vehicle-performance?start=2030-01-01',
        )
      ).status,
    ).toBe(400)
    const unclosed = await bookingRepository.create(
      {
        ...repositoryBookingData(tenantId, customerId),
        vehicleId: vehicle.id,
        customerRate: 999999,
      },
      '2045-01-02',
      user.id,
    )
    expect(unclosed.id).toBeDefined()
    expect(
      (
        await vehiclePerformance(tenantId, 'OWN', '1900-01-01', '2100-12-31')
      ).items.find((item) => item.id === vehicle.id),
    ).toEqual(row)
    await prisma.bookingClosure.update({
      where: { bookingId: booking.id },
      data: { totalBillAmount: 350 },
    })
    const zero = (
      await vehiclePerformance(tenantId, 'OWN', '1900-01-01', '2100-12-31')
    ).items.find((item) => item.id === vehicle.id)!
    expect(zero).toMatchObject({
      revenue: 0,
      netProfit: -1800,
      profitPercent: null,
    })
    const vendor = await prisma.vendor.findFirstOrThrow({ where: { tenantId } })
    await prisma.vehicle.update({
      where: { id: vehicle.id },
      data: { ownershipType: 'VENDOR', vendorId: vendor.id },
    })
    await prisma.booking.update({
      where: { id: booking.id },
      data: { assignmentSource: 'VENDOR', vendorId: vendor.id },
    })
    await prisma.bookingClosure.update({
      where: { bookingId: booking.id },
      data: {
        totalBillAmount: 20450,
        tollTax: 750,
        parking: 100,
        driverAllowance: 600,
        finalVendorPayable: 17450,
        dieselCost: 0,
        directVehicleExpense: 0,
        driverCost: 0,
        allocatedOfficeExpense: 0,
      },
    })
    expect(
      (
        await vehiclePerformance(tenantId, 'OWN', '1900-01-01', '2100-12-31')
      ).items.some((item) => item.id === vehicle.id),
    ).toBe(false)
    const vendorRow = (
      await vehiclePerformance(tenantId, 'VENDOR', '1900-01-01', '2100-12-31')
    ).items.find((item) => item.id === vehicle.id)!
    expect(vendorRow).toMatchObject({
      revenue: 19000,
      vendorCost: 16000,
      fuelCost: 0,
      extraCost: 0,
      netProfit: 3000,
      profitPercent: 15.79,
    })
    const vendorApi = await authorized(
      'get',
      '/api/v1/tenant/dashboard/vehicle-performance?ownership=VENDOR',
    )
    expect(vendorApi.status).toBe(200)
    expect(vendorApi.body.data.ownership).toBe('VENDOR')
    expect(
      (
        await authorized(
          'get',
          '/api/v1/tenant/dashboard/vehicle-performance?ownership=INVALID',
        )
      ).status,
    ).toBe(400)
    const otherTenant = await prisma.tenant.findFirstOrThrow({
      where: { id: { not: tenantId } },
    })
    expect(
      (
        await vehiclePerformance(
          otherTenant.id,
          'OWN',
          '1900-01-01',
          '2100-12-31',
        )
      ).items.some((item) => item.id === vehicle.id),
    ).toBe(false)
  })
})

describe('business profit card', () => {
  it('adds own and vendor profits and returns their breakdown for the same date range', async () => {
    const user = await prisma.tenantUser.findFirstOrThrow({
      where: { tenantId },
    })
    const vendor = await prisma.vendor.findFirstOrThrow({ where: { tenantId } })
    for (const assignmentSource of ['OWN', 'VENDOR'] as const) {
      const booking = await bookingRepository.create(
        {
          ...repositoryBookingData(tenantId, customerId),
          assignmentSource,
          vendorId: assignmentSource === 'VENDOR' ? vendor.id : null,
          vendorPayableAmount: assignmentSource === 'VENDOR' ? 15000 : 0,
          startDate: new Date('2047-01-15'),
          endDate: new Date('2047-01-15'),
        },
        '2047-01-15',
        user.id,
      )
      const response = await authorized(
        'post',
        `/api/v1/tenant/bookings/${booking.id}/close`,
      ).send({
        billingTripType: 'PACKAGE_BASED',
        packageAmount: assignmentSource === 'OWN' ? 25000 : 20000,
        dieselCost: assignmentSource === 'OWN' ? 5000 : 0,
        vendorPayableAmount: assignmentSource === 'VENDOR' ? 15000 : 0,
      })
      expect(response.status).toBe(200)
    }
    expect(
      await cardMetric(tenantId, 'profit', '2047-01-15', '2047-01-15'),
    ).toMatchObject({ value: 25000, ownProfit: 20000, vendorProfit: 5000 })
    expect(
      await cardMetric(tenantId, 'profit', '2047-01-16', '2047-01-16'),
    ).toMatchObject({ value: 0, ownProfit: 0, vendorProfit: 0 })
    const response = await authorized(
      'get',
      '/api/v1/tenant/dashboard/card?metric=profit&start=2047-01-01&end=2047-01-31',
    )
    expect(response.status).toBe(200)
    expect(response.body.data).toMatchObject({
      value: 25000,
      ownProfit: 20000,
      vendorProfit: 5000,
    })
  })
})

describe('local package closing extras', () => {
  it('requires closing readings and time and bills 65 extra km and two extra hours', async () => {
    const user = await prisma.tenantUser.findFirstOrThrow({
      where: { tenantId },
    })
    const booking = await bookingRepository.create(
      {
        ...repositoryBookingData(tenantId, customerId),
        bookingType: 'LOCAL',
        bookingPackage: 'local_12_120',
        startDate: new Date('2048-02-01'),
        endDate: new Date('2048-02-01'),
        pickupTime: '08:00',
        vehicleId,
      },
      '2048-02-01',
      user.id,
    )
    const path = `/api/v1/tenant/bookings/${booking.id}/close`
    const closing = {
      billingTripType: 'PACKAGE_BASED',
      packageAmount: 5000,
      startKm: 1000,
      endKm: 1185,
      closingDate: '2048-02-01',
      extraKmRate: 20,
      extraHourRate: 200,
      dieselCost: 1000,
    }
    expect((await authorized('post', path).send(closing)).status).toBe(400)
    expect(
      (
        await authorized('post', path).send({
          ...closing,
          closingTime: '07:00',
        })
      ).status,
    ).toBe(400)
    const response = await authorized('post', path).send({
      ...closing,
      closingTime: '22:00',
    })
    expect(response.status).toBe(200)
    expect(response.body.data.closeDetails).toMatchObject({
      totalBillAmount: 6700,
      baseFare: 6700,
      netVehicleProfit: 5700,
      localPackageBilling: {
        totalMinutes: 840,
        includedHours: 12,
        includedKm: 120,
        extraKm: 65,
        extraHours: 2,
        extraKmCharge: 1300,
        extraHourCharge: 400,
        closingTime: '22:00',
      },
    })
    const invoice = await prisma.invoice.findFirstOrThrow({
      where: { tenantId, bookingId: booking.id },
      include: { items: true },
    })
    expect(Number(invoice.netPayable)).toBe(6700)
    expect(
      invoice.items.map((item) => ({
        description: item.description,
        amount: Number(item.amount),
      })),
    ).toEqual(
      expect.arrayContaining([
        { description: 'Package Fare', amount: 5000 },
        { description: 'Extra Kilometres', amount: 1300 },
        { description: 'Extra Hours', amount: 400 },
      ]),
    )
    expect(
      invoice.items.reduce((sum, item) => sum + Number(item.amount), 0),
    ).toBe(6700)
    const detail = await authorized(
      'get',
      `/api/v1/tenant/bookings/${booking.id}`,
    )
    expect(detail.body.data.closeDetails.localPackageBilling.extraKmRate).toBe(
      20,
    )
  })
})
