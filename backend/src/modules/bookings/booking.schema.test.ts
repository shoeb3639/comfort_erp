import { closeBookingSchema } from './booking.schema'

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
