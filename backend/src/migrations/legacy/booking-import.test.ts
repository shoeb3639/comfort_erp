import {
  BOOKING_DETAIL_HEADERS,
  DAILY_BOOKING_HEADERS,
  prepareBookingMigration,
  type BookingMigrationMappings,
} from './booking-import'
import { toCsv } from './csv'
import { PRAYAGRAJ_TENANT_ID } from './vendor-import'

function daily(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    id: '1',
    booking_id: 'CMF25-1222-101',
    customer_id: '404',
    status: 'Closed',
    booking_type: 'Local 8 Hrs/80 Kms',
    journey_type: 'Roundtrip',
    vehicle_type: 'Toyota Innova',
    from_city: 'Prayagraj',
    to_city: 'Local',
    reprt_address: 'Civil Lines',
    reprt_time: '12:30 PM',
    start_date: '2025-12-22',
    end_date: '2025-12-22',
    price: '₹ 18/km',
    company_rate: '2/km',
    vendor_rate: '16/km',
    vendor: 'CMFV-999',
    vehicle_no: 'UP 70 AA 0001',
    driver: 'Test Driver',
    driver_no: '9999999999',
    paymentStatus: 'Received',
    comissionStatus: 'Received',
    remark: 'Legacy booking',
    ...overrides,
  }
  return DAILY_BOOKING_HEADERS.map((header) => values[header])
}

function detail(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    id: '8',
    booking_id: 'CMF25-1222-101',
    tripStartDate: '0000-00-00',
    tripEndDate: '0000-00-00',
    vehicleNo: '',
    vendorId: '',
    income: '10000',
    expenses: '8000',
    balance: '2000',
    totalKm: '80',
    rate: '18',
    tollTax: '100',
    parking: '40',
    night: '300',
    totalPayment: '1440',
    totalPending: '',
    paymentStatus: 'Received',
    paymentMode: 'Online',
    comission: '200',
    comissionStatus: 'Received',
    diesel: '500',
    dieselPaidBy: 'Party',
    totalExpense: '',
    miscExpense: '25',
    paymentCompany: '',
    paymentDriver: '300',
    remark: 'Closed',
    dutySlip: '',
    ...overrides,
  }
  return BOOKING_DETAIL_HEADERS.map((header) => values[header])
}

const mappings: BookingMigrationMappings = {
  customers: new Map(),
  vendors: new Map(),
  vehicles: new Map(),
  driversByPhone: new Map(),
  driversByName: new Map(),
}

describe('legacy booking migration preparation', () => {
  it('preserves long IDs, creates placeholders, and applies approved mappings', () => {
    const result = prepareBookingMigration(
      toCsv([DAILY_BOOKING_HEADERS, daily()]),
      toCsv([BOOKING_DETAIL_HEADERS, detail()]),
      PRAYAGRAJ_TENANT_ID,
      mappings,
    )
    expect(result.bookingRejections).toHaveLength(0)
    expect(result.placeholders).toHaveLength(1)
    expect(result.bookings[0]).toMatchObject({
      bookingNumber: 'CMF25-1222-101',
      status: 'CLOSED',
      bookingType: 'LOCAL',
      tripType: 'ROUNDTRIP',
      pickupTime: '12:30',
      pricingBasis: 'RATE_PER_KM',
      customerRate: 18,
      vendorId: null,
      vehicleId: null,
      driverId: null,
    })
    expect(result.closures[0]).toMatchObject({
      billingTripType: 'KM_BASED',
      dateSubstituted: true,
      ratePerKm: 18,
      billingKm: 80,
    })
  })

  it('quarantines blank, orphan, and every duplicated detail row', () => {
    const result = prepareBookingMigration(
      toCsv([DAILY_BOOKING_HEADERS, daily()]),
      toCsv([
        BOOKING_DETAIL_HEADERS,
        detail({ id: '1', booking_id: '' }),
        detail({ id: '2', booking_id: 'ORPHAN' }),
        detail({ id: '3' }),
        detail({ id: '4' }),
      ]),
      PRAYAGRAJ_TENANT_ID,
      mappings,
    )
    expect(result.closures).toHaveLength(0)
    expect(result.detailRejections.map((row) => row.reason)).toEqual([
      'BLANK_BOOKING_ID',
      'ORPHAN_BOOKING_ID',
      'DUPLICATE_BOOKING_DETAIL',
      'DUPLICATE_BOOKING_DETAIL',
    ])
  })

  it('imports bookings without details and normalizes blank status', () => {
    const result = prepareBookingMigration(
      toCsv([
        DAILY_BOOKING_HEADERS,
        daily({
          status: '',
          booking_type: 'Varanasi',
          journey_type: 'Dropping',
        }),
      ]),
      toCsv([BOOKING_DETAIL_HEADERS]),
      PRAYAGRAJ_TENANT_ID,
      mappings,
    )
    expect(result.bookings[0]).toMatchObject({
      status: 'CONFIRMED',
      bookingType: 'OUTSTATION',
      tripType: 'ONE_WAY',
    })
    expect(result.closures).toHaveLength(0)
  })
})
