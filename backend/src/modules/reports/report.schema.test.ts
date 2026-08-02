import { reportParamsSchema, reportQuerySchema } from './report.schema'
import { getCatalog } from './report.service'

describe('report contracts', () => {
  it('publishes only the approved go-live catalog', () => {
    expect(getCatalog().map((report) => report.key)).toEqual([
      'business-summary',
      'booking-register',
      'invoice-register',
      'outstanding-invoices',
      'expense-register',
      'vehicle-utilization',
      'vendor-duty',
    ])
  })

  it('rejects unsupported reports and invalid filter ranges', () => {
    expect(
      reportParamsSchema.validate({ reportKey: 'fuel-analysis' }).error,
    ).toBeDefined()
    expect(
      reportQuerySchema.validate({
        dateFrom: '2026-08-31',
        dateTo: '2026-08-01',
      }).error,
    ).toBeDefined()
    expect(reportQuerySchema.validate({ limit: 501 }).error).toBeDefined()
  })

  it('accepts tenant report filters and applies safe pagination defaults', () => {
    const result = reportQuerySchema.validate({
      dateFrom: '2026-08-01',
      dateTo: '2026-08-31',
      assignmentSource: 'OWN',
      search: 'BKNG-100001',
    })
    expect(result.error).toBeUndefined()
    expect(result.value).toMatchObject({ page: 1, limit: 100 })
  })
})
