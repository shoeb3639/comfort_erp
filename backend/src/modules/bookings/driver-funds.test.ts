import { driverBalance, validateDriverFunds } from './driver-funds'

const payment = {
  paymentHolder: 'DRIVER',
  paymentAmount: 3000,
  paymentMode: 'CASH',
  fuelAmount: 2500,
  fuelReceiptId: 'receipt',
  dieselCost: 2500,
}

describe('customer payments used by drivers', () => {
  it('keeps fuel use and partial returns separate from the customer payment', () => {
    expect(() => validateDriverFunds(payment, false)).not.toThrow()
    expect(driverBalance(3000, 2500, 0)).toBe(500)
    expect(driverBalance(3000, 2500, 200)).toBe(300)
    expect(driverBalance(3000, 2500, 500)).toBe(0)
    expect(driverBalance(1, 0.7, 0.2)).toBe(0.1)
  })
  it('requires proof and prevents allocating more than received or expensed', () => {
    expect(() =>
      validateDriverFunds({ ...payment, fuelReceiptId: null }, false),
    ).toThrow('Upload the fuel receipt')
    expect(() =>
      validateDriverFunds({ ...payment, fuelAmount: 3001 }, false),
    ).toThrow('cannot exceed')
    expect(() =>
      validateDriverFunds({ ...payment, dieselCost: 2000 }, false),
    ).toThrow('Total diesel cost')
    expect(() =>
      validateDriverFunds({ ...payment, paymentHolder: 'COMPANY' }, false),
    ).toThrow('requires payment received by the driver')
  })
  it('allows driver UPI custody and requires vendor fuel to be included in the deduction', () => {
    expect(() =>
      validateDriverFunds({ ...payment, paymentMode: 'UPI' }, false),
    ).not.toThrow()
    expect(() => validateDriverFunds(payment, true)).toThrow('vendor deduction')
    expect(() =>
      validateDriverFunds({ ...payment, vendorDeduction: 2500 }, true),
    ).not.toThrow()
    expect(() =>
      validateDriverFunds({ ...payment, paymentMode: 'CARD' }, false),
    ).toThrow('cash, UPI or bank transfer')
  })
})
