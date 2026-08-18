import { getFoundation, normalizeReferenceNumber } from './accounts.service'

describe('Accounts foundation service', () => {
  it('normalizes references consistently for tenant-scoped duplicate checks', () => {
    expect(normalizeReferenceNumber('  utr  2026 / 001  ')).toBe(
      'UTR 2026 / 001',
    )
  })

  it('returns only navigation authorized by the current permission set', () => {
    const foundation = getFoundation([
      'accounts.collection.view',
      'accounts.ledger.view',
      'booking.view',
    ])

    expect(foundation.permissions).toEqual([
      'accounts.collection.view',
      'accounts.ledger.view',
    ])
    expect(foundation.navigation.map((item) => item.id)).toEqual([
      'overview',
      'collections',
      'manager-ledger',
    ])
    expect(foundation.policies.tenantIdFromAuthenticatedContext).toBe(true)
    expect(foundation.enums.paymentModes).toContain('BANK_TRANSFER')
  })
})
