import {
  prepareVendorMigration,
  PRAYAGRAJ_TENANT_ID,
  resolveVendorMigration,
  VENDOR_HEADERS,
} from './vendor-import'

const source = `${VENDOR_HEADERS.join(',')}\n1,CMFV-001,comfort cars,9450965103,prayagraj,Civil Lines,25-01-1992,5,1\n2,CMFV-002,rajesh singh,9838253770,prayagraj,Katauhla,05-11-2019,2,2\n`

describe('legacy vendor migration preparation', () => {
  it('maps own company separately and prepares external vendors', () => {
    const prepared = prepareVendorMigration(source, PRAYAGRAJ_TENANT_ID)

    expect(prepared.sourceRows).toBe(2)
    expect(prepared.ownCompanyMappings).toEqual([
      expect.objectContaining({
        legacyVendorId: 'CMFV-001',
        ownershipType: 'OWN',
        targetVendorId: null,
      }),
    ])
    expect(prepared.accepted).toEqual([
      expect.objectContaining({
        vendorCode: 'CMFV-002',
        name: 'Rajesh Singh',
        phone: '9838253770',
        city: 'Prayagraj',
        recordType: 'external_vendor',
      }),
    ])
    expect(prepared.rejected).toHaveLength(0)
  })

  it('rejects invalid and duplicate source records', () => {
    const invalid = `${VENDOR_HEADERS.join(',')}\n1,CMFV-002,A,12,P,x,not-a-date,-1,bad\n1,CMFV-002,Valid Name,9838253770,Prayagraj,x,05-11-2019,2,2\n`
    const prepared = prepareVendorMigration(invalid, PRAYAGRAJ_TENANT_ID)

    expect(prepared.duplicates).toHaveLength(2)
    expect(prepared.accepted).toHaveLength(0)
    expect(prepared.rejected).toHaveLength(2)
  })

  it('refuses a different tenant', () => {
    expect(() =>
      prepareVendorMigration(source, '00000000-0000-4000-8000-000000000000'),
    ).toThrow('approved only for Prayagraj tenant')
  })

  it('reuses exact natural matches and blocks ambiguous name matches', () => {
    const prepared = prepareVendorMigration(source, PRAYAGRAJ_TENANT_ID)
    const base = {
      vendorCode: 'VEN-CURRENT',
      recordType: 'external_vendor',
      category: 'Fleet',
      rating: 0,
      city: 'Prayagraj',
      status: 'ACTIVE',
    }

    expect(
      resolveVendorMigration(prepared, [
        {
          ...base,
          id: 'existing-id',
          name: 'Rajesh Singh',
          phone: '9838253770',
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        action: 'REUSE_EXISTING',
        targetId: 'existing-id',
      }),
    ])
    expect(
      resolveVendorMigration(prepared, [
        {
          ...base,
          id: 'existing-id',
          name: 'Rajesh Singh',
          phone: '9999999999',
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        action: 'CONFLICT',
        reason: 'NAME_MATCH_WITH_DIFFERENT_PHONE',
      }),
    ])
  })
})
