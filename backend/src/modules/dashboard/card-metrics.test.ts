import { cardRange } from './card-metrics'
describe('card date ranges', () => {
  it('includes the entire final day and handles leap days', () => {
    expect(cardRange('2024-02-01', '2024-02-29').until).toBe('2024-03-01')
    expect(cardRange('2026-12-31', '2026-12-31').until).toBe('2027-01-01')
  })
  it.each([
    ['2026-02-30', '2026-03-01'],
    ['2026-03-02', '2026-03-01'],
    ['bad', '2026-03-01'],
    ['1899-01-01', '2026-03-01'],
  ])('rejects invalid ranges %s to %s', (start, end) => {
    expect(() => cardRange(start, end)).toThrow()
  })
})
