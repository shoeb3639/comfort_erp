import {
  groupVehicleLedger,
  mapBookingLedgerEntry,
  mapExpenseLedgerEntry,
  summarizeVehicleLedger,
} from './vehicle.mapper'

const booking = {
  id: 'booking-id',
  bookingNumber: 'BKNG-000001',
  startDate: new Date('2026-08-18T00:00:00.000Z'),
  travellingFrom: 'Prayagraj',
  travellingTo: 'Varanasi',
  serviceCity: 'Prayagraj',
  status: 'CLOSED',
  openingOdometer: 1000,
  closingOdometer: 1250,
  customer: { billingName: 'Example Customer' },
  driver: { name: 'Example Driver' },
  closure: {
    actualRunningKm: 250,
    baseFare: 5000,
    tollTax: 500,
    parking: 100,
    driverAllowance: 200,
    otherRecoverableCharges: 50,
    totalBillAmount: 5850,
    dieselCost: 1000,
    directVehicleExpense: 200,
    driverCost: 500,
    allocatedOfficeExpense: 300,
    vehicleRevenue: 5000,
    netVehicleProfit: 3000,
    finalVendorPayable: 4200,
    vendorBookingProfit: 1600,
  },
}

describe('vehicle ledger mapper', () => {
  it('maps approved own-vehicle booking profit', () => {
    const entry = mapBookingLedgerEntry(booking, 'OWN')

    expect(entry).toMatchObject({
      entryType: 'BOOKING',
      runningKm: 250,
      billedAmount: 5850,
      recoverableCharges: 850,
      revenue: 5000,
      bookingCost: 2000,
      netProfit: 3000,
      includedInProfit: true,
    })
  })

  it('uses vendor economics for a vendor vehicle', () => {
    const entry = mapBookingLedgerEntry(booking, 'VENDOR')

    expect(entry).toMatchObject({
      revenue: 5800,
      bookingCost: 4200,
      netProfit: 1600,
    })
  })

  it('subtracts unallocated vehicle expenses and flags booking-linked expenses', () => {
    const overhead = mapExpenseLedgerEntry(
      {
        id: 'expense-1',
        transactionDate: new Date('2026-08-19T00:00:00.000Z'),
        bookingId: null,
        category: 'VEHICLE_MAINTENANCE',
        amount: 400,
        description: 'Oil service',
        referenceNumber: 'EXP-1',
      },
      null,
    )
    const linked = mapExpenseLedgerEntry(
      {
        id: 'expense-2',
        transactionDate: new Date('2026-08-19T00:00:00.000Z'),
        bookingId: 'booking-id',
        category: 'FUEL',
        amount: 1000,
        description: 'Trip diesel',
        referenceNumber: 'EXP-2',
      },
      'BKNG-000001',
    )
    const bookingEntry = mapBookingLedgerEntry(booking, 'OWN')
    const summary = summarizeVehicleLedger([bookingEntry, overhead, linked])

    expect(overhead.netProfit).toBe(-400)
    expect(linked.netProfit).toBe(0)
    expect(summary).toMatchObject({
      revenue: 5000,
      bookingCosts: 2000,
      additionalVehicleExpenses: 400,
      linkedExpensesForReview: 1000,
      netProfit: 2600,
    })
    expect(groupVehicleLedger([bookingEntry, overhead], 'MONTH')).toEqual([
      expect.objectContaining({ period: '2026-08', netProfit: 2600 }),
    ])
  })
})
