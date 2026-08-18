import {
  updateVehicleSchema,
  vehicleQuerySchema,
  vehicleSchema,
  vehicleTypeSchema,
} from './vehicle.schema'

describe('vehicle validation', () => {
  const vehicle = {
    ownershipType: 'OWN',
    vendorId: null,
    registrationNumber: 'up70ab1234',
    vehicleTypeId: '00000000-0000-4000-8000-000000000001',
  }

  it('accepts a valid vehicle and normalizes its registration case', () => {
    const result = vehicleSchema.validate(vehicle)

    expect(result.error).toBeUndefined()
    expect(result.value).toMatchObject({
      registrationNumber: 'UP70AB1234',
      status: 'ACTIVE',
    })
  })

  it('rejects invalid ownership, query, and vehicle-type values', () => {
    expect(
      vehicleSchema.validate({ ...vehicle, ownershipType: 'LEASED' }).error,
    ).toBeDefined()
    expect(
      vehicleQuerySchema.validate({ status: 'MAINTENANCE' }).error,
    ).toBeDefined()
    expect(vehicleTypeSchema.validate({ name: 'S' }).error).toBeDefined()
  })

  it('accepts a partial update but rejects an empty update', () => {
    expect(updateVehicleSchema.validate({ make: 'Tata' }).error).toBeUndefined()
    expect(updateVehicleSchema.validate({}).error).toBeDefined()
  })
})
