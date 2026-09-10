import { localPackageBilling } from './local-package-billing'
const input = {
  bookingPackage: 'local_12_120',
  startDate: '2026-09-10',
  openingTime: '08:00',
  closingDate: '2026-09-10',
  closingTime: '22:00',
  actualKm: 185,
  packageBased: true,
  extraKmRate: 20,
  extraHourRate: 200,
}
describe('local package billing', () => {
  it('calculates the requested 12h/120km example', () => {
    expect(localPackageBilling(input)).toMatchObject({
      totalMinutes: 840,
      extraKm: 65,
      extraHours: 2,
      extraKmCharge: 1300,
      extraHourCharge: 400,
    })
  })
  it('handles overnight journeys and prorates partial hours', () => {
    expect(
      localPackageBilling({
        ...input,
        openingTime: '20:00',
        closingDate: '2026-09-11',
        closingTime: '09:30',
      }),
    ).toMatchObject({
      totalMinutes: 810,
      extraHours: 1.5,
      extraHourCharge: 300,
    })
  })
  it('does not charge within package limits or double-charge kilometre-based fares', () => {
    expect(
      localPackageBilling({ ...input, actualKm: 120, closingTime: '20:00' }),
    ).toMatchObject({ extraKmCharge: 0, extraHourCharge: 0 })
    expect(
      localPackageBilling({ ...input, packageBased: false }),
    ).toMatchObject({ extraKmCharge: 0, extraHourCharge: 400 })
  })
  it('requires explicit excess rates, but accepts zero to waive charges', () => {
    expect(() =>
      localPackageBilling({ ...input, extraKmRate: undefined }),
    ).toThrow()
    expect(() =>
      localPackageBilling({ ...input, extraHourRate: undefined }),
    ).toThrow()
    expect(
      localPackageBilling({ ...input, extraKmRate: 0, extraHourRate: 0 }),
    ).toMatchObject({ extraKmCharge: 0, extraHourCharge: 0 })
  })
  it('rejects missing or invalid closing times and reversed trips', () => {
    expect(() =>
      localPackageBilling({ ...input, closingTime: undefined }),
    ).toThrow()
    expect(() =>
      localPackageBilling({ ...input, closingTime: '24:00' }),
    ).toThrow()
    expect(() =>
      localPackageBilling({ ...input, closingTime: '07:00' }),
    ).toThrow()
    expect(() =>
      localPackageBilling({ ...input, closingDate: '2026-02-30' }),
    ).toThrow()
  })
})
