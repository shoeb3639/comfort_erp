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
    bookingType: 'LOCAL' as const,
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
