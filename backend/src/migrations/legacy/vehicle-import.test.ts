import {
  parseVendorMappings,
  prepareVehicleMigration,
  resolveVehicleMigration,
  VEHICLE_HEADERS,
  VENDOR_MAP_HEADERS,
} from './vehicle-import'
import { PRAYAGRAJ_TENANT_ID } from './vendor-import'

const vendorMap = parseVendorMappings(
  `${VENDOR_MAP_HEADERS.join(',')}\n1,CMFV-001,Comfort Cars,,OWN,OWN_COMPANY_MAPPING\n2,CMFV-002,Rajesh Singh,00000000-0000-4000-8000-000000000002,VENDOR,EXISTING_EXACT\n`,
)

describe('legacy vehicle migration preparation', () => {
  it('maps own/external vehicles and infers Innova as SUV', () => {
    const source = `${VEHICLE_HEADERS.join(',')}\n3,CMFV-001,Comfort Cars,Tata Nexon,Sedan,UP 70 HP 1089\n4,CMFV-002,Rajesh Singh,Innova Crysta,,UP23Y4318\n`
    const prepared = prepareVehicleMigration(
      source,
      PRAYAGRAJ_TENANT_ID,
      vendorMap,
    )
    expect(prepared.rejected).toHaveLength(0)
    expect(prepared.accepted).toEqual([
      expect.objectContaining({
        ownershipType: 'OWN',
        vendorId: null,
        registrationNumber: 'UP70HP1089',
        vehicleTypeName: 'Sedan',
      }),
      expect.objectContaining({
        ownershipType: 'VENDOR',
        vendorId: '00000000-0000-4000-8000-000000000002',
        vehicleTypeName: 'SUV',
      }),
    ])
    expect(prepared.accepted[1]?.legacy.inferredVehicleType).toBe(true)
  })

  it('rejects a blank plate and every row in a duplicate plate group', () => {
    const source = `${VEHICLE_HEADERS.join(',')}\n3,CMFV-001,Comfort Cars,Nexon,Sedan,\n4,CMFV-002,Rajesh Singh,Amaze,Sedan,UP23Y4318\n5,CMFV-002,Rajesh Singh,Amaze,Sedan,UP 23 Y 4318\n`
    const prepared = prepareVehicleMigration(
      source,
      PRAYAGRAJ_TENANT_ID,
      vendorMap,
    )
    expect(prepared.accepted).toHaveLength(0)
    expect(prepared.rejected).toHaveLength(3)
    expect(prepared.duplicates).toEqual([
      expect.objectContaining({ field: 'registration_number' }),
    ])
  })

  it('is tenant locked and requires a mapped vendor', () => {
    const source = `${VEHICLE_HEADERS.join(',')}\n3,CMFV-999,Unknown,Nexon,Sedan,UP70HP1089\n`
    expect(
      prepareVehicleMigration(source, PRAYAGRAJ_TENANT_ID, vendorMap).rejected,
    ).toEqual([expect.objectContaining({ reason: 'VENDOR_MAPPING_NOT_FOUND' })])
    expect(() =>
      prepareVehicleMigration(
        source,
        '00000000-0000-4000-8000-000000000000',
        vendorMap,
      ),
    ).toThrow('approved only for Prayagraj tenant')
  })

  it('reuses an exact registration match and blocks changed ownership', () => {
    const source = `${VEHICLE_HEADERS.join(',')}\n3,CMFV-001,Comfort Cars,Tata Nexon,Sedan,UP70HP1089\n`
    const prepared = prepareVehicleMigration(
      source,
      PRAYAGRAJ_TENANT_ID,
      vendorMap,
    )
    const existing = {
      id: 'existing-id',
      vehicleCode: 'VEH-CURRENT',
      registrationNumber: 'UP70HP1089',
      ownershipType: 'OWN',
      vendorId: null,
      vehicleTypeName: 'Sedan',
      make: null,
      model: 'Tata Nexon',
      status: 'ACTIVE',
    }
    expect(resolveVehicleMigration(prepared, [existing])).toEqual([
      expect.objectContaining({ action: 'REUSE_EXISTING' }),
    ])
    expect(
      resolveVehicleMigration(prepared, [
        { ...existing, ownershipType: 'VENDOR' },
      ]),
    ).toEqual([
      expect.objectContaining({
        action: 'CONFLICT',
        reason: 'REGISTRATION_ALREADY_USED_BY_DIFFERENT_VEHICLE',
      }),
    ])
  })
})
