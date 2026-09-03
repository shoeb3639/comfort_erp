import type { VehicleOwnershipType } from '../../generated/prisma/client'
import type {
  VehicleLedgerEntry,
  VehicleLedgerGroupBy,
  VehicleLedgerPeriod,
  VehicleLedgerTotals,
} from './vehicle.types'

function number(value: unknown) {
  return Number(value || 0)
}

function date(value: Date) {
  return value.toISOString().slice(0, 10)
}

interface BookingLedgerRecord {
  id: string
  bookingNumber: string
  startDate: Date
  travellingFrom: string | null
  travellingTo: string | null
  serviceCity: string
  status: string
  openingOdometer: unknown
  closingOdometer: unknown
  customer: { billingName: string }
  driver: { name: string } | null
  closure: {
    actualRunningKm: unknown
    baseFare: unknown
    tollTax: unknown
    parking: unknown
    driverAllowance: unknown
    otherRecoverableCharges: unknown
    totalBillAmount: unknown
    dieselCost: unknown
    directVehicleExpense: unknown
    driverCost: unknown
    allocatedOfficeExpense: unknown
    vehicleRevenue: unknown
    netVehicleProfit: unknown
    finalVendorPayable: unknown
    vendorBookingProfit: unknown
    commissionProfit: unknown
    profitDataStatus: string
  } | null
}

interface ExpenseLedgerRecord {
  id: string
  transactionDate: Date
  bookingId: string | null
  category: string | null
  amount: unknown
  description: string
  referenceNumber: string
}

export function mapBookingLedgerEntry(
  record: BookingLedgerRecord,
  ownershipType: VehicleOwnershipType,
): VehicleLedgerEntry {
  const closure = record.closure
  const profitDataStatus = closure
    ? closure.profitDataStatus || 'AVAILABLE'
    : null
  const profitAvailable = profitDataStatus === 'AVAILABLE'
  const recoverableCharges = closure
    ? number(closure.tollTax) +
      number(closure.parking) +
      number(closure.driverAllowance) +
      number(closure.otherRecoverableCharges)
    : 0
  const revenue = closure
    ? ownershipType === 'VENDOR'
      ? number(closure.baseFare) +
        number(closure.tollTax) +
        number(closure.parking) +
        number(closure.driverAllowance)
      : number(closure.vehicleRevenue)
    : 0
  const bookingCost = closure
    ? ownershipType === 'VENDOR'
      ? number(closure.finalVendorPayable)
      : number(closure.dieselCost) +
        number(closure.directVehicleExpense) +
        number(closure.driverCost) +
        number(closure.allocatedOfficeExpense)
    : 0
  const netProfit =
    closure && profitAvailable
      ? ownershipType === 'VENDOR'
        ? number(closure.vendorBookingProfit)
        : number(closure.netVehicleProfit)
      : null
  const route =
    [record.travellingFrom, record.travellingTo].filter(Boolean).join(' → ') ||
    record.serviceCity

  return {
    id: `booking:${record.id}`,
    entryType: 'BOOKING',
    date: date(record.startDate),
    bookingId: record.id,
    bookingNumber: record.bookingNumber,
    customer: record.customer.billingName,
    driver: record.driver?.name ?? null,
    route,
    status: record.status,
    description: `${record.bookingNumber} — ${record.customer.billingName}`,
    category: null,
    referenceNumber: record.bookingNumber,
    openingKm:
      record.openingOdometer === null ? null : number(record.openingOdometer),
    closingKm:
      record.closingOdometer === null ? null : number(record.closingOdometer),
    runningKm: closure ? number(closure.actualRunningKm) : 0,
    billedAmount: closure ? number(closure.totalBillAmount) : 0,
    recoverableCharges,
    revenue,
    bookingCost,
    expenseAmount: 0,
    linkedExpenseForReview: 0,
    netProfit,
    commissionProfit: closure ? number(closure.commissionProfit) : 0,
    profitDataStatus,
    includedInProfit: Boolean(closure && profitAvailable),
    profitTreatment: closure
      ? profitAvailable
        ? 'Approved close-booking P&L'
        : profitDataStatus === 'NOT_TRACKED'
          ? 'Profit not tracked before vehicle ledger launch'
          : profitDataStatus === 'INCOMPLETE'
            ? 'Vehicle ledger period; source profit fields incomplete'
            : 'Register-only period; profit unavailable'
      : 'Pending booking closure',
  }
}

export function mapExpenseLedgerEntry(
  record: ExpenseLedgerRecord,
  bookingNumber: string | null,
): VehicleLedgerEntry {
  const amount = number(record.amount)
  const linkedToBooking = Boolean(record.bookingId)
  return {
    id: `expense:${record.id}`,
    entryType: 'EXPENSE',
    date: date(record.transactionDate),
    bookingId: record.bookingId,
    bookingNumber,
    customer: null,
    driver: null,
    route: null,
    status: 'POSTED',
    description: record.description,
    category: record.category,
    referenceNumber: record.referenceNumber,
    openingKm: null,
    closingKm: null,
    runningKm: 0,
    billedAmount: 0,
    recoverableCharges: 0,
    revenue: 0,
    bookingCost: 0,
    expenseAmount: amount,
    linkedExpenseForReview: linkedToBooking ? amount : 0,
    netProfit: linkedToBooking ? 0 : -amount,
    commissionProfit: 0,
    profitDataStatus: null,
    includedInProfit: !linkedToBooking,
    profitTreatment: linkedToBooking
      ? 'Review only; excluded to prevent double-counting booking costs'
      : 'Additional vehicle overhead',
  }
}

function emptyTotals(): VehicleLedgerTotals {
  return {
    bookings: 0,
    closedBookings: 0,
    expenseEntries: 0,
    runningKm: 0,
    billedAmount: 0,
    recoverableCharges: 0,
    revenue: 0,
    bookingCosts: 0,
    additionalVehicleExpenses: 0,
    linkedExpensesForReview: 0,
    netProfit: 0,
    commissionProfit: 0,
  }
}

function addEntry(totals: VehicleLedgerTotals, entry: VehicleLedgerEntry) {
  if (entry.entryType === 'BOOKING') {
    totals.bookings += 1
    if (entry.includedInProfit) totals.closedBookings += 1
  } else totals.expenseEntries += 1
  totals.runningKm += entry.runningKm
  totals.billedAmount += entry.billedAmount
  totals.recoverableCharges += entry.recoverableCharges
  if (entry.entryType !== 'BOOKING' || entry.includedInProfit) {
    totals.revenue += entry.revenue
    totals.bookingCosts += entry.bookingCost
  }
  if (entry.entryType === 'EXPENSE' && entry.includedInProfit)
    totals.additionalVehicleExpenses += entry.expenseAmount
  totals.linkedExpensesForReview += entry.linkedExpenseForReview
  totals.netProfit += entry.netProfit ?? 0
  totals.commissionProfit += entry.commissionProfit
  return totals
}

export function summarizeVehicleLedger(entries: VehicleLedgerEntry[]) {
  return entries.reduce(addEntry, emptyTotals())
}

export function groupVehicleLedger(
  entries: VehicleLedgerEntry[],
  groupBy: VehicleLedgerGroupBy,
): VehicleLedgerPeriod[] {
  const periods = new Map<string, VehicleLedgerTotals>()
  for (const entry of entries) {
    const period = groupBy === 'MONTH' ? entry.date.slice(0, 7) : entry.date
    periods.set(period, addEntry(periods.get(period) ?? emptyTotals(), entry))
  }
  return Array.from(periods, ([period, totals]) => ({
    period,
    ...totals,
  })).sort((left, right) => right.period.localeCompare(left.period))
}
