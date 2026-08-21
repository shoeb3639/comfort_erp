import {
  DRIVER_HEADERS,
  prepareDriverMigration,
  resolveDriverMigration,
} from './driver-import'
import { parseVendorMappings, VENDOR_MAP_HEADERS } from './vehicle-import'
import { PRAYAGRAJ_TENANT_ID } from './vendor-import'

const vendorMap = parseVendorMappings(
  `${VENDOR_MAP_HEADERS.join(',')}\n1,CMFV-001,Comfort Cars,,OWN,OWN_COMPANY_MAPPING\n2,CMFV-002,Rajesh Singh,00000000-0000-4000-8000-000000000002,VENDOR,EXISTING_EXACT\n`,
)

describe('legacy driver migration preparation', () => {
  it('maps own and vendor drivers with normalized proper-case values', () => {
    const source = `${DRIVER_HEADERS.join(',')}\n1,CMFV-001,kAMLESH,+91 89329 96820,civil lines,\n2,CMFV-002,arun,7388443662,,9000000000\n`
    const prepared = prepareDriverMigration(
      source,
      PRAYAGRAJ_TENANT_ID,
      vendorMap,
    )
    expect(prepared.rejected).toHaveLength(0)
    expect(prepared.accepted).toEqual([
      expect.objectContaining({
        engagementType: 'OWN',
        vendorId: null,
        name: 'Kamlesh',
        mobile: '918932996820',
        address: 'Civil Lines',
      }),
      expect.objectContaining({
        engagementType: 'VENDOR',
        vendorId: '00000000-0000-4000-8000-000000000002',
        name: 'Arun',
        alternateMobile: '9000000000',
      }),
    ])
  })

  it('rejects unmapped vendors and duplicate accepted drivers', () => {
    const source = `${DRIVER_HEADERS.join(',')}\n1,CMFV-999,Unknown,9999999999,,\n2,CMFV-002,Arun,7388443662,,\n3,CMFV-002,arun,7388443662,,\n`
    const prepared = prepareDriverMigration(
      source,
      PRAYAGRAJ_TENANT_ID,
      vendorMap,
    )
    expect(prepared.accepted).toHaveLength(0)
    expect(prepared.rejected).toHaveLength(3)
    expect(prepared.duplicates).toEqual([
      expect.objectContaining({ field: 'name_mobile' }),
    ])
  })

  it('is locked to the Prayagraj tenant', () => {
    const source = `${DRIVER_HEADERS.join(',')}\n1,CMFV-001,Kamlesh,8932996820,,\n`
    expect(() =>
      prepareDriverMigration(
        source,
        '00000000-0000-4000-8000-000000000000',
        vendorMap,
      ),
    ).toThrow('approved only for Prayagraj tenant')
  })

  it('reuses an exact driver and blocks a different vendor link', () => {
    const source = `${DRIVER_HEADERS.join(',')}\n1,CMFV-001,Kamlesh,8932996820,,\n`
    const prepared = prepareDriverMigration(
      source,
      PRAYAGRAJ_TENANT_ID,
      vendorMap,
    )
    const existing = {
      id: 'existing-id',
      driverCode: 'DRV-CURRENT',
      engagementType: 'OWN',
      vendorId: null,
      name: 'Kamlesh',
      mobile: '8932996820',
      status: 'ACTIVE',
    }
    expect(resolveDriverMigration(prepared, [existing])).toEqual([
      expect.objectContaining({ action: 'REUSE_EXISTING' }),
    ])
    expect(
      resolveDriverMigration(prepared, [
        {
          ...existing,
          engagementType: 'VENDOR',
          vendorId: '00000000-0000-4000-8000-000000000002',
        },
      ]),
    ).toEqual([
      expect.objectContaining({
        action: 'CONFLICT',
        reason: 'NAME_AND_MOBILE_LINKED_DIFFERENTLY',
      }),
    ])
  })
})
