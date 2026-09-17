import {
  createCustomerSchema,
  customerBookingOptionsQuerySchema,
  travellerBookingOptionsQuerySchema,
  updateCustomerSchema,
} from './customer.schema'

describe('customer schemas', () => {
  it('allows email, city, and billing address to be omitted', () => {
    const result = createCustomerSchema.validate({
      type: 'RETAIL',
      name: 'Legacy Customer',
      billingName: 'Legacy Customer',
      phone: '9876543210',
    })

    expect(result.error).toBeUndefined()
  })

  it('accepts blank optional customer fields', () => {
    const result = createCustomerSchema.validate({
      type: 'CORPORATE',
      name: 'Legacy Company',
      billingName: 'Legacy Company',
      phone: '9876543210',
      email: '',
      city: '',
      billingAddress: '',
    })

    expect(result.error).toBeUndefined()
  })

  it('allows optional fields to be cleared during an update', () => {
    const result = updateCustomerSchema.validate({
      email: null,
      city: null,
      billingAddress: null,
    })

    expect(result.error).toBeUndefined()
  })

  it('defaults booking option searches to a small page and caps the limit', () => {
    expect(customerBookingOptionsQuerySchema.validate({}).value).toMatchObject({
      page: 1,
      limit: 20,
    })
    expect(
      customerBookingOptionsQuerySchema.validate({ limit: 51 }).error,
    ).toBeDefined()
    expect(
      travellerBookingOptionsQuerySchema.validate({ q: '98', limit: 50 }).error,
    ).toBeUndefined()
  })
})
