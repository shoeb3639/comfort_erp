import { minimumBillingKm } from './booking.service'

describe('outstation minimum billing', () => {
  it('bills at least 250 km for a one-day minimum 250 package', () => {
    const minimum = minimumBillingKm(
      'outstation_min_250',
      new Date('2026-08-03'),
      new Date('2026-08-03'),
    )

    expect(minimum).toBe(250)
    expect(Math.max(180, minimum)).toBe(250)
  })

  it('applies the minimum for every inclusive outstation day', () => {
    const minimum = minimumBillingKm(
      'outstation_min_250',
      new Date('2026-08-03'),
      new Date('2026-08-04'),
    )

    expect(minimum).toBe(500)
    expect(Math.max(420, minimum)).toBe(500)
  })
})
