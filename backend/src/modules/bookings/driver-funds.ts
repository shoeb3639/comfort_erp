import { AppError } from '../../shared/errors/app-error'

export function driverBalance(amount: number, fuel: number, returned: number) {
  return Math.round((amount - fuel - returned) * 100) / 100
}

export function validateDriverFunds(
  input: {
    paymentHolder?: string
    paymentAmount?: number
    paymentMode?: string
    fuelAmount?: number
    fuelReceiptId?: string | null
    dieselCost?: number
    vendorDeduction?: number
  },
  isVendor: boolean,
) {
  const fuel = input.fuelAmount ?? 0
  if (input.paymentHolder !== 'DRIVER') {
    if (fuel || input.fuelReceiptId)
      throw new AppError(
        'Fuel allocation requires payment received by the driver',
        'INVALID_DRIVER_FUNDS',
        400,
      )
    return
  }
  if (
    !(input.paymentAmount! > 0) ||
    !['CASH', 'UPI', 'BANK_TRANSFER'].includes(input.paymentMode ?? '')
  )
    throw new AppError(
      'Driver-held payments require a positive cash, UPI or bank transfer amount',
      'INVALID_DRIVER_FUNDS',
      400,
    )
  if (fuel > input.paymentAmount!)
    throw new AppError(
      'Fuel spent from this payment cannot exceed the amount received',
      'FUEL_EXCEEDS_COLLECTION',
      400,
    )
  if (fuel > 0 && !input.fuelReceiptId)
    throw new AppError(
      'Upload the fuel receipt before closing this booking',
      'FUEL_RECEIPT_REQUIRED',
      400,
    )
  if (!fuel && input.fuelReceiptId)
    throw new AppError(
      'Enter the fuel amount for this receipt',
      'INVALID_DRIVER_FUNDS',
      400,
    )
  // The allocation explains use of a payment; the expense must be counted only once.
  if (
    fuel > (isVendor ? (input.vendorDeduction ?? 0) : (input.dieselCost ?? 0))
  )
    throw new AppError(
      isVendor
        ? 'Include this fuel amount in the vendor deduction'
        : 'Total diesel cost must include fuel paid from the customer payment',
      'FUEL_COST_REQUIRED',
      400,
    )
}
