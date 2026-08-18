import {
  driverQuerySchema,
  driverSchema,
  updateDriverSchema,
} from './driver.schema'

describe('driver validation', () => {
  it('accepts and normalizes a valid own driver', () => {
    const result = driverSchema.validate({
      engagementType: 'OWN',
      vendorId: null,
      salutation: 'MR',
      name: '  syed kashif  ',
      mobile: '9999999999',
      licenceNumber: 'up-70-12345',
    })

    expect(result.error).toBeUndefined()
    expect(result.value).toMatchObject({
      name: 'syed kashif',
      licenceNumber: 'UP-70-12345',
      status: 'ACTIVE',
    })
  })

  it('rejects unsupported engagement and status values', () => {
    expect(
      driverSchema.validate({
        engagementType: 'CONTRACTOR',
        name: 'Test Driver',
        mobile: '9999999999',
      }).error,
    ).toBeDefined()

    expect(
      driverQuerySchema.validate({ status: 'OFFLINE' }).error,
    ).toBeDefined()
  })

  it('accepts a partial update but rejects an empty update', () => {
    expect(
      updateDriverSchema.validate({ address: 'Prayagraj' }).error,
    ).toBeUndefined()
    expect(updateDriverSchema.validate({}).error).toBeDefined()
  })
})
