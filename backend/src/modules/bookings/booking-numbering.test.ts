import { tenantBusinessDate } from '../../shared/date/tenant-business-date'
import { formatBookingNumber } from './booking-numbering'

describe('booking numbering', () => {
  it.each([
    [1, '26-0904001'],
    [2, '26-0904002'],
    [11, '26-0904011'],
    [999, '26-0904999'],
    [1000, '26-09041000'],
  ])('formats sequence %i with a minimum width of three', (sequence, value) => {
    expect(formatBookingNumber('2026-09-04', sequence)).toBe(value)
  })

  it('switches dates at midnight in the tenant timezone', () => {
    expect(
      tenantBusinessDate('Asia/Kolkata', new Date('2026-09-04T18:29:59Z')),
    ).toBe('2026-09-04')
    expect(
      tenantBusinessDate('Asia/Kolkata', new Date('2026-09-04T18:30:00Z')),
    ).toBe('2026-09-05')
  })
})
