import { AppError } from '../../shared/errors/app-error'

export function driverBalance(
  amount: number,
  fuel: number,
  returned: number,
  vehicleExpense = 0,
) {
  return Math.round((amount - fuel - vehicleExpense - returned) * 100) / 100
}

export function validateDriverFunds(
  input: {
    paymentHolder?: string
    paymentAmount?: number
    paymentMode?: string
    fuelAmount?: number
    fuelReceiptId?: string | null
    vehicleExpenseAmount?: number
    vehicleExpenseReason?: string | null
    dieselCost?: number
    directVehicleExpense?: number
    vendorDeduction?: number
  },
  isVendor: boolean,
) {
  const fuel = input.fuelAmount ?? 0
  const vehicleExpense = input.vehicleExpenseAmount ?? 0
  if (input.paymentHolder !== 'DRIVER') {
    if (
      fuel ||
      input.fuelReceiptId ||
      vehicleExpense ||
      input.vehicleExpenseReason
    )
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
  if (vehicleExpense > 0 && !input.vehicleExpenseReason?.trim())
    throw new AppError(
      'Enter a reason for the vehicle expense paid by the driver',
      'VEHICLE_EXPENSE_REASON_REQUIRED',
      400,
    )
  if (fuel + vehicleExpense > input.paymentAmount!)
    throw new AppError(
      'Fuel and vehicle expenses cannot exceed the amount received by the driver',
      'DRIVER_EXPENSE_EXCEEDS_COLLECTION',
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
  if (
    vehicleExpense >
    (isVendor
      ? (input.vendorDeduction ?? 0) - fuel
      : (input.directVehicleExpense ?? 0))
  )
    throw new AppError(
      isVendor
        ? 'Include driver-paid fuel and vehicle expenses in the vendor deduction'
        : 'Direct vehicle expense must include the amount paid from the customer payment',
      'VEHICLE_EXPENSE_COST_REQUIRED',
      400,
    )
}
