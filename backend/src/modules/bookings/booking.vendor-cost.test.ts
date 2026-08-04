import { calculateVendorCost } from './booking.service'

describe('vendor cost calculation', () => {
  it('passes toll, parking and driver allowance through to vendor payable', () => {
    expect(
      calculateVendorCost({
        baseFare: 7000,
        tollTax: 500,
        parking: 200,
        driverAllowance: 300,
        vendorPayableAmount: 5000,
        vendorExtraCharges: 0,
        vendorDeduction: 0,
      }),
    ).toEqual({
      recoverableCharges: 1000,
      revenue: 8000,
      finalPayable: 6000,
      profit: 2000,
    })
  })

  it('applies vendor extras and deductions after pass-through charges', () => {
    expect(
      calculateVendorCost({
        baseFare: 7000,
        tollTax: 500,
        parking: 200,
        driverAllowance: 300,
        vendorPayableAmount: 5000,
        vendorExtraCharges: 250,
        vendorDeduction: 100,
      }).finalPayable,
    ).toBe(6150)
  })
})
