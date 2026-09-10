import { closeBookingSchema, dutyCompleteSchema } from './booking.schema'

const closing = {
  billingTripType: 'PACKAGE_BASED',
  packageAmount: 1000,
}

describe('booking closing payment validation', () => {
  it('allows a booking to close without an initial payment', () => {
    const result = closeBookingSchema.validate(closing)
    expect(result.error).toBeUndefined()
    expect(result.value.paymentAmount).toBe(0)
  })

  it('requires collection details when payment is received', () => {
    const result = closeBookingSchema.validate({
      ...closing,
      paymentAmount: 500,
    })
    expect(result.error).toBeDefined()
  })

  it('accepts complete initial collection details', () => {
    const result = closeBookingSchema.validate({
      ...closing,
      paymentAmount: 500,
      paymentMode: 'UPI',
      paymentDate: '2026-08-03',
      paymentReference: 'UPI-12345',
      collectedBy: 'Accounts Desk',
    })
    expect(result.error).toBeUndefined()
  })
})

describe('duty completion payment validation', () => {
  it('allows recoverable charges without payment details', () => {
    const result = dutyCompleteSchema.validate({
      closingOdometer: 1200,
      tollTax: 100,
      parking: 50,
    })

    expect(result.error).toBeUndefined()
    expect(result.value).toMatchObject({
      tollTax: 100,
      parking: 50,
      driverAllowance: 0,
      otherRecoverableCharges: 0,
    })
  })

  it('rejects payment details because managers capture them at closing', () => {
    const result = dutyCompleteSchema.validate({
      closingOdometer: 1200,
      paymentAmount: 500,
      paymentMode: 'UPI',
    })

    expect(result.error).toBeDefined()
  })
})

describe('fuel quantity validation', () => {
  it.each([null, 0, 25.5])(
    'accepts optional recorded litres %s',
    (fuelConsumedLitres) => {
      const result = closeBookingSchema.validate({
        ...closing,
        fuelConsumedLitres,
      })
      expect(result.error).toBeUndefined()
      expect(result.value.fuelConsumedLitres).toBe(fuelConsumedLitres)
    },
  )
  it('preserves missing quantities and rejects negative litres', () => {
    expect(
      closeBookingSchema.validate(closing).value.fuelConsumedLitres,
    ).toBeUndefined()
    expect(
      closeBookingSchema.validate({ ...closing, fuelConsumedLitres: -1 }).error,
    ).toBeDefined()
  })
})
