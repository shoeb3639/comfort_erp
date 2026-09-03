import { createHash } from 'node:crypto'
import { clean, parseCsv } from './csv'
import { normalizeDriverPhone } from './driver-import'
import { normalizeRegistration } from './vehicle-import'
import { deterministicUuid, PRAYAGRAJ_TENANT_ID } from './vendor-import'

export const DAILY_BOOKING_HEADERS = [
  'id',
  'booking_id',
  'customer_id',
  'status',
  'booking_type',
  'journey_type',
  'vehicle_type',
  'from_city',
  'to_city',
  'reprt_address',
  'reprt_time',
  'start_date',
  'end_date',
  'price',
  'company_rate',
  'vendor_rate',
  'vendor',
  'vehicle_no',
  'driver',
  'driver_no',
  'paymentStatus',
  'comissionStatus',
  'remark',
] as const

export const BOOKING_DETAIL_HEADERS = [
  'id',
  'booking_id',
  'tripStartDate',
  'tripEndDate',
  'vehicleNo',
  'vendorId',
  'income',
  'expenses',
  'balance',
  'totalKm',
  'rate',
  'tollTax',
  'parking',
  'night',
  'totalPayment',
  'totalPending',
  'paymentStatus',
  'paymentMode',
  'comission',
  'comissionStatus',
  'diesel',
  'dieselPaidBy',
  'totalExpense',
  'miscExpense',
  'paymentCompany',
  'paymentDriver',
  'remark',
  'dutySlip',
] as const

type DailyHeader = (typeof DAILY_BOOKING_HEADERS)[number]
type DetailHeader = (typeof BOOKING_DETAIL_HEADERS)[number]
type DailyRow = Record<DailyHeader, string>
type DetailRow = Record<DetailHeader, string>

export interface BookingMigrationMappings {
  customers: Map<string, { customerId: string; travellerId: string | null }>
  vendors: Map<
    string,
    { vendorId: string | null; ownershipType: 'OWN' | 'VENDOR' }
  >
  vehicles: Map<string, string>
  driversByPhone: Map<string, string>
  driversByName: Map<string, string[]>
}

export interface PreparedPlaceholderCustomer {
  id: string
  tenantId: string
  customerCode: string
  type: 'RETAIL'
  name: string
  billingName: string
  phone: string
  status: 'ACTIVE'
  legacyCustomerId: string
}

export interface PreparedBooking {
  id: string
  tenantId: string
  bookingNumber: string
  customerId: string
  travellerId: string | null
  bookingType:
    'LOCAL' | 'AIRPORT_TRANSFER' | 'RAILWAY_STATION_TRANSFER' | 'OUTSTATION'
  bookingPackage: string | null
  tripType: 'ONE_WAY' | 'ROUNDTRIP'
  serviceCity: string
  startDate: Date
  endDate: Date
  pickupTime: string
  travellingFrom: string | null
  travellingTo: string | null
  pickupReportingAddress: string
  requestedVehicleType: string
  assignmentSource: 'OWN' | 'VENDOR'
  vendorId: string | null
  vehicleId: string | null
  driverId: string | null
  pricingBasis: 'FIXED' | 'RATE_PER_KM'
  customerRate: number
  vendorRateType: string | null
  vendorRate: number | null
  vendorPayableAmount: number | null
  status: 'CLOSED' | 'ASSIGNED' | 'CONFIRMED'
  notes: string | null
  dateCorrected: boolean
  legacy: DailyRow & { rowNumber: number; resourceWarnings: string[] }
}

export interface PreparedClosure {
  id: string
  tenantId: string
  bookingId: string
  legacyDetailId: string
  billingTripType: 'KM_BASED' | 'PACKAGE_BASED'
  actualRunningKm: number
  minimumBillingKm: number
  billingKm: number
  ratePerKm: number | null
  packageAmount: number | null
  baseFare: number
  tollTax: number
  parking: number
  driverAllowance: number
  totalBillAmount: number
  dieselCost: number
  directVehicleExpense: number
  driverCost: number
  vehicleRevenue: number
  vendorPayableAmount: number
  finalVendorPayable: number
  remarks: string | null
  dateSubstituted: boolean
  legacy: DetailRow & {
    rowNumber: number
    resolvedStartDate: string
    resolvedEndDate: string
  }
}

export interface DetailRejection {
  rowNumber: number
  legacyId: string
  bookingNumber: string
  reason: string
}

function rowsFor<T extends readonly string[]>(source: string, expected: T) {
  const records = parseCsv(source.replace(/^\uFEFF/, ''))
  const headers = records.shift()
  if (!headers || headers.join('|') !== expected.join('|'))
    throw new Error(`Unexpected CSV headers. Expected: ${expected.join(', ')}`)
  return records
    .filter((values) => values.some(clean))
    .map((values, index) => ({
      rowNumber: index + 2,
      row: Object.fromEntries(
        expected.map((key, i) => [key, values[i] ?? '']),
      ) as Record<T[number], string>,
    }))
}

function normalizedText(value: string) {
  return clean(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
}

function number(value: string) {
  const match = clean(value)
    .replaceAll(',', '')
    .match(/-?\d+(?:\.\d+)?/)
  return match ? Number(match[0]) : 0
}

function optionalNumber(value: string) {
  return clean(value) ? number(value) : null
}

function date(value: string, field: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean(value)))
    throw new Error(`INVALID_${field.toUpperCase()}`)
  const result = new Date(`${clean(value)}T00:00:00.000Z`)
  if (Number.isNaN(result.valueOf()))
    throw new Error(`INVALID_${field.toUpperCase()}`)
  return result
}

function time12To24(value: string) {
  const match = clean(value).match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i)
  if (!match) throw new Error('INVALID_REPORTING_TIME')
  let hour = Number(match[1])
  const minute = Number(match[2])
  if (hour < 1 || hour > 12 || minute > 59)
    throw new Error('INVALID_REPORTING_TIME')
  if (match[3]!.toUpperCase() === 'AM') hour %= 12
  else if (hour !== 12) hour += 12
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function bookingType(
  value: string,
): Pick<PreparedBooking, 'bookingType' | 'bookingPackage'> {
  const source = clean(value)
  const key = normalizedText(source)
  if (key.includes('AIRPORT'))
    return { bookingType: 'AIRPORT_TRANSFER', bookingPackage: source }
  if (key.includes('RAILWAY'))
    return { bookingType: 'RAILWAY_STATION_TRANSFER', bookingPackage: source }
  if (key.startsWith('LOCAL') && !key.includes('OUTSTATION'))
    return { bookingType: 'LOCAL', bookingPackage: source }
  return { bookingType: 'OUTSTATION', bookingPackage: source || null }
}

function bookingStatus(value: string): PreparedBooking['status'] {
  const key = normalizedText(value)
  if (key === 'CLOSED') return 'CLOSED'
  if (key === 'ASSIGN') return 'ASSIGNED'
  return 'CONFIRMED'
}

function tripType(value: string): PreparedBooking['tripType'] {
  return normalizedText(value) === 'ROUNDTRIP' ? 'ROUNDTRIP' : 'ONE_WAY'
}

export function parseCustomerMappings(source: string) {
  const rows = parseCsv(source.replace(/^\uFEFF/, ''))
  const headers = rows.shift() ?? []
  const legacyIndex = headers.indexOf('legacy_customer_id')
  const customerIndex = headers.indexOf('new_customer_uuid')
  const travellerIndex = headers.indexOf('new_traveller_uuid')
  if (legacyIndex < 0 || customerIndex < 0 || travellerIndex < 0)
    throw new Error('Invalid customer mapping CSV')
  const candidates = new Map<
    string,
    Array<{ customerId: string; travellerId: string | null }>
  >()
  for (const row of rows) {
    const legacyId = clean(row[legacyIndex])
    const customerId = clean(row[customerIndex])
    if (!legacyId || !customerId) continue
    const mapping = {
      customerId,
      travellerId: clean(row[travellerIndex]) || null,
    }
    candidates.set(legacyId, [...(candidates.get(legacyId) ?? []), mapping])
  }
  const result = new Map<
    string,
    { customerId: string; travellerId: string | null }
  >()
  for (const [legacyId, mappings] of candidates) {
    const customerIds = [...new Set(mappings.map((row) => row.customerId))]
    // A legacy customer id occasionally identifies multiple independent people.
    // Leaving it unresolved makes the approved placeholder policy safer than an
    // arbitrary link to the wrong customer.
    if (customerIds.length !== 1) continue
    result.set(
      legacyId,
      mappings.find((row) => row.travellerId) ?? mappings[0]!,
    )
  }
  return result
}

export function parseResourceMappings(
  vendorSource: string,
  vehicleSource: string,
  driverSource: string,
) {
  const generic = (source: string) => {
    const rows = parseCsv(source.replace(/^\uFEFF/, ''))
    const headers = rows.shift() ?? []
    return { headers, rows: rows.filter((row) => row.some(clean)) }
  }
  const vendorCsv = generic(vendorSource)
  const vehicleCsv = generic(vehicleSource)
  const driverCsv = generic(driverSource)
  const vendors = new Map<
    string,
    { vendorId: string | null; ownershipType: 'OWN' | 'VENDOR' }
  >()
  for (const row of vendorCsv.rows)
    vendors.set(clean(row[1] ?? '').toUpperCase(), {
      vendorId: clean(row[3] ?? '') || null,
      ownershipType:
        clean(row[4] ?? '').toUpperCase() === 'OWN' ? 'OWN' : 'VENDOR',
    })
  const vehicles = new Map<string, string>()
  for (const row of vehicleCsv.rows)
    if (clean(row[2] ?? '') && clean(row[3] ?? ''))
      vehicles.set(normalizeRegistration(row[2] ?? ''), clean(row[3] ?? ''))
  const driversByPhone = new Map<string, string>()
  const driversByName = new Map<string, string[]>()
  for (const row of driverCsv.rows) {
    const name = normalizedText(row[2] ?? '')
    const phone = normalizeDriverPhone(row[3] ?? '')
    const id = clean(row[4] ?? '')
    if (phone && id) driversByPhone.set(phone, id)
    if (name && id)
      driversByName.set(name, [...(driversByName.get(name) ?? []), id])
  }
  return { vendors, vehicles, driversByPhone, driversByName }
}

export function prepareBookingMigration(
  dailySource: string,
  detailSource: string,
  tenantId: string,
  mappings: BookingMigrationMappings,
) {
  if (tenantId !== PRAYAGRAJ_TENANT_ID)
    throw new Error(
      `Booking source is approved only for Prayagraj tenant ${PRAYAGRAJ_TENANT_ID}`,
    )
  const dailyRows = rowsFor(dailySource, DAILY_BOOKING_HEADERS) as Array<{
    rowNumber: number
    row: DailyRow
  }>
  const detailRows = rowsFor(detailSource, BOOKING_DETAIL_HEADERS) as Array<{
    rowNumber: number
    row: DetailRow
  }>
  const placeholders = new Map<string, PreparedPlaceholderCustomer>()
  const bookings: PreparedBooking[] = []
  const bookingRejections: Array<{
    rowNumber: number
    bookingNumber: string
    reason: string
  }> = []

  for (const { row, rowNumber } of dailyRows) {
    try {
      const bookingNumber = clean(row.booking_id)
      if (!bookingNumber || bookingNumber.length > 20)
        throw new Error('INVALID_BOOKING_ID')
      const legacyCustomerId = clean(row.customer_id)
      let customer = mappings.customers.get(legacyCustomerId)
      if (!customer) {
        const id = deterministicUuid(
          `old-booking-placeholder-customer:${tenantId}:${legacyCustomerId}`,
        )
        placeholders.set(legacyCustomerId, {
          id,
          tenantId,
          customerCode: `LEGACY-MISSING-${legacyCustomerId}`.slice(0, 50),
          type: 'RETAIL',
          name: `Legacy Customer ${legacyCustomerId}`,
          billingName: `Legacy Customer ${legacyCustomerId}`,
          phone: `UNKNOWN-${legacyCustomerId}`.slice(0, 30),
          status: 'ACTIVE',
          legacyCustomerId,
        })
        customer = { customerId: id, travellerId: null }
      }
      const vendor = mappings.vendors.get(clean(row.vendor).toUpperCase())
      const vehicleId =
        mappings.vehicles.get(normalizeRegistration(row.vehicle_no)) ?? null
      const phoneDriver = mappings.driversByPhone.get(
        normalizeDriverPhone(row.driver_no),
      )
      const nameDrivers =
        mappings.driversByName.get(normalizedText(row.driver)) ?? []
      const driverId =
        phoneDriver ?? (nameDrivers.length === 1 ? nameDrivers[0]! : null)
      const warnings: string[] = []
      if (clean(row.vendor) && !vendor) warnings.push('UNRESOLVED_VENDOR')
      if (clean(row.vehicle_no) && !vehicleId)
        warnings.push('UNRESOLVED_VEHICLE')
      if ((clean(row.driver) || clean(row.driver_no)) && !driverId)
        warnings.push('UNRESOLVED_DRIVER')
      const pricePerKm = /\/\s*km/i.test(row.price)
      const type = bookingType(row.booking_type)
      const startDate = date(row.start_date, 'start_date')
      const sourceEndDate = date(row.end_date, 'end_date')
      const dateCorrected = sourceEndDate < startDate
      const endDate = dateCorrected ? startDate : sourceEndDate
      bookings.push({
        id: deterministicUuid(`old-bookings:${tenantId}:${bookingNumber}`),
        tenantId,
        bookingNumber,
        customerId: customer.customerId,
        travellerId: customer.travellerId,
        ...type,
        tripType: tripType(row.journey_type),
        serviceCity: clean(row.from_city) || 'Prayagraj',
        startDate,
        endDate,
        pickupTime: time12To24(row.reprt_time),
        travellingFrom: clean(row.from_city) || null,
        travellingTo: clean(row.to_city) || null,
        pickupReportingAddress:
          clean(row.reprt_address) || 'Legacy address unavailable',
        requestedVehicleType: clean(row.vehicle_type) || 'Unspecified',
        assignmentSource: vendor?.ownershipType === 'VENDOR' ? 'VENDOR' : 'OWN',
        vendorId: vendor?.vendorId ?? null,
        vehicleId,
        driverId,
        pricingBasis: pricePerKm ? 'RATE_PER_KM' : 'FIXED',
        customerRate: number(row.price),
        vendorRateType: clean(row.vendor_rate)
          ? /\/\s*km/i.test(row.vendor_rate)
            ? 'RATE_PER_KM'
            : 'FIXED'
          : null,
        vendorRate: optionalNumber(row.vendor_rate),
        vendorPayableAmount: pricePerKm
          ? null
          : optionalNumber(row.vendor_rate),
        status: bookingStatus(row.status),
        notes: clean(row.remark) || null,
        dateCorrected,
        legacy: { ...row, rowNumber, resourceWarnings: warnings },
      })
    } catch (error) {
      bookingRejections.push({
        rowNumber,
        bookingNumber: clean(row.booking_id),
        reason: error instanceof Error ? error.message : 'INVALID_BOOKING',
      })
    }
  }

  const acceptedByNumber = new Map(
    bookings.map((row) => [row.bookingNumber, row]),
  )
  const detailCounts = new Map<string, number>()
  for (const { row } of detailRows) {
    const key = clean(row.booking_id)
    if (key) detailCounts.set(key, (detailCounts.get(key) ?? 0) + 1)
  }
  const closures: PreparedClosure[] = []
  const detailRejections: DetailRejection[] = []
  for (const { row, rowNumber } of detailRows) {
    const bookingNumber = clean(row.booking_id)
    const booking = acceptedByNumber.get(bookingNumber)
    let reason: string | null = null
    if (!bookingNumber) reason = 'BLANK_BOOKING_ID'
    else if (!booking) reason = 'ORPHAN_BOOKING_ID'
    else if ((detailCounts.get(bookingNumber) ?? 0) > 1)
      reason = 'DUPLICATE_BOOKING_DETAIL'
    if (reason) {
      detailRejections.push({
        rowNumber,
        legacyId: clean(row.id),
        bookingNumber,
        reason,
      })
      continue
    }
    const acceptedBooking = booking!
    const substituted =
      !clean(row.tripStartDate) ||
      !clean(row.tripEndDate) ||
      row.tripStartDate === '0000-00-00' ||
      row.tripEndDate === '0000-00-00'
    const km = number(row.totalKm)
    const rate = optionalNumber(row.rate)
    const kmBased = acceptedBooking.pricingBasis === 'RATE_PER_KM'
    const total = number(row.totalPayment)
    const vendorPayable = number(row.expenses)
    closures.push({
      id: deterministicUuid(
        `old-booking-closure:${tenantId}:${row.id}:${acceptedBooking.id}`,
      ),
      tenantId,
      bookingId: acceptedBooking.id,
      legacyDetailId: clean(row.id),
      billingTripType: kmBased ? 'KM_BASED' : 'PACKAGE_BASED',
      actualRunningKm: km,
      minimumBillingKm: km,
      billingKm: km,
      ratePerKm: kmBased ? rate : null,
      packageAmount: kmBased ? null : (rate ?? total),
      baseFare: total,
      tollTax: number(row.tollTax),
      parking: number(row.parking),
      driverAllowance: number(row.night),
      totalBillAmount: total,
      dieselCost: number(row.diesel),
      directVehicleExpense: number(row.miscExpense),
      driverCost: number(row.paymentDriver),
      vehicleRevenue: number(row.income),
      vendorPayableAmount: vendorPayable,
      finalVendorPayable: vendorPayable,
      remarks: clean(row.remark) || null,
      dateSubstituted: substituted,
      legacy: {
        ...row,
        rowNumber,
        resolvedStartDate: substituted
          ? acceptedBooking.startDate.toISOString().slice(0, 10)
          : clean(row.tripStartDate),
        resolvedEndDate: substituted
          ? acceptedBooking.endDate.toISOString().slice(0, 10)
          : clean(row.tripEndDate),
      },
    })
  }
  return {
    dailySha256: createHash('sha256').update(dailySource).digest('hex'),
    detailSha256: createHash('sha256').update(detailSource).digest('hex'),
    dailySourceRows: dailyRows.length,
    detailSourceRows: detailRows.length,
    bookings,
    closures,
    placeholders: [...placeholders.values()],
    bookingRejections,
    detailRejections,
  }
}
