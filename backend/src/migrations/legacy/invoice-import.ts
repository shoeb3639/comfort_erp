import { createHash } from 'node:crypto'
import { clean, parseCsv } from './csv'
import { deterministicUuid, PRAYAGRAJ_TENANT_ID } from './vendor-import'

export const INVOICE_HEADERS = [
  'id',
  'invoice_no',
  'issue_date',
  'issuedBy',
  'booking_id',
  'json_data',
  'companyName',
  'companyGST',
  'invoiceType',
  'customer',
  'total_amount',
  'isGSTCharge',
  'gstAmount',
  'serviceCharge',
  'vehicle',
] as const

type InvoiceHeader = (typeof INVOICE_HEADERS)[number]
type LegacyInvoiceRow = Record<InvoiceHeader, string>

interface LegacyTrip {
  use_date?: unknown
  vehicle?: unknown
  travelling?: unknown
  km?: unknown
  rate?: unknown
  total_amt?: unknown
  localPkg?: unknown
  baseCharge?: unknown
  extKm?: unknown
  rtPerKm?: unknown
  extHr?: unknown
  rtPerHr?: unknown
  [key: string]: unknown
}

interface LegacyDetails {
  bookingId?: unknown
  cus_name?: unknown
  company_name?: unknown
  gstin_no?: unknown
  address?: unknown
  trip_details?: unknown
  sub_total?: unknown
  tollTax?: unknown
  parking?: unknown
  da?: unknown
  serviceCharge?: unknown
  cgst?: unknown
  sgst?: unknown
  igst?: unknown
  grand_total?: unknown
  [key: string]: unknown
}

export interface InvoiceMigrationBooking {
  id: string
  bookingNumber: string
  customerId: string
}

export interface InvoiceMigrationCustomer {
  id: string
  name: string
  billingName: string
  gstin: string | null
}

export interface InvoiceMigrationMappings {
  bookings: InvoiceMigrationBooking[]
  customers: InvoiceMigrationCustomer[]
}

export interface PreparedInvoiceCustomer {
  id: string
  tenantId: string
  customerCode: string
  type: 'RETAIL'
  name: string
  billingName: string
  phone: string
  city: null
  gstin: string | null
  billingAddress: string
  status: 'ACTIVE'
  identityKey: string
}

export interface PreparedInvoiceItem {
  id: string
  tenantId: string
  invoiceId: string
  dateType: 'single' | 'blank'
  serviceDate: Date | null
  serviceStartDate: null
  serviceEndDate: null
  description: string
  quantity: number
  unit: string
  rate: number
  amount: number
  sortOrder: number
}

export interface PreparedInvoice {
  id: string
  tenantId: string
  bookingId: string | null
  customerId: string
  invoiceNumber: string
  invoiceSequence: null
  invoicePrefix: 'LEGACY'
  financialYear: string
  invoiceDate: Date
  status: 'GENERATED'
  gstType: 'NO_GST' | 'CGST_SGST' | 'IGST'
  billingName: string
  billingAddress: string
  customerGstin: string | null
  referenceNumber: string | null
  billingType: string | null
  billingContact: string | null
  vehicleDescription: string | null
  displaySnapshot: Record<string, unknown>
  subtotal: number
  taxableAmount: number
  cgstAmount: number
  sgstAmount: number
  igstAmount: number
  totalGst: number
  netPayable: number
  generatedAt: Date
  legacy: LegacyInvoiceRow & {
    rowNumber: number
    bookingResolution: string
    customerResolution: string
    sourceTotalAmount: number
    sourceGrandTotal: number
    reconciliationAdjustment: number
  }
  items: PreparedInvoiceItem[]
}

export interface InvoiceRejection {
  rowNumber: number
  legacyId: string
  invoiceNumber: string
  bookingReference: string
  reason: string
}

function scalar(value: unknown) {
  return typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
    ? String(value)
    : ''
}

function normalized(value: unknown) {
  return clean(scalar(value))
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
}

function money(value: unknown) {
  const raw = scalar(value).replaceAll(',', '').replace('₹', '').trim()
  if (!raw || raw.toUpperCase() === 'NAN') return 0
  const match = raw.match(/-?\d+(?:\.\d+)?/)
  return match ? Number(match[0]) : 0
}

function gstin(value: unknown) {
  const match = scalar(value)
    .toUpperCase()
    .match(/[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]/)
  return match?.[0] ?? null
}

function parseDate(value: string) {
  const match = clean(value).match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (!match) throw new Error('INVALID_ISSUE_DATE')
  const result = new Date(`${match[3]}-${match[2]}-${match[1]}T00:00:00.000Z`)
  if (Number.isNaN(result.valueOf())) throw new Error('INVALID_ISSUE_DATE')
  return result
}

function optionalServiceDate(value: unknown) {
  const raw = scalar(value).trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null
  const result = new Date(`${raw}T00:00:00.000Z`)
  return Number.isNaN(result.valueOf()) ? null : result
}

function financialYear(date: Date) {
  const year = date.getUTCFullYear()
  const start = date.getUTCMonth() >= 3 ? year : year - 1
  return `${start}-${String(start + 1).slice(-2)}`
}

function parseRows(source: string) {
  const records = parseCsv(source.replace(/^\uFEFF/, ''))
  const headers = records.shift()
  if (!headers || headers.join('|') !== INVOICE_HEADERS.join('|'))
    throw new Error(
      `Unexpected invoice CSV headers. Expected: ${INVOICE_HEADERS.join(', ')}`,
    )
  return records
    .filter((row) => row.some(clean))
    .map((values, index) => ({
      rowNumber: index + 2,
      row: Object.fromEntries(
        INVOICE_HEADERS.map((header, i) => [header, values[i] ?? '']),
      ) as LegacyInvoiceRow,
    }))
}

function details(row: LegacyInvoiceRow) {
  const parsed = JSON.parse(row.json_data) as {
    invoice_details?: LegacyDetails
  }
  if (!parsed.invoice_details || typeof parsed.invoice_details !== 'object')
    throw new Error('MISSING_INVOICE_DETAILS')
  return parsed.invoice_details
}

function invoiceIdentity(row: LegacyInvoiceRow, detail: LegacyDetails) {
  const name =
    clean(row.companyName) ||
    clean(scalar(detail.company_name)) ||
    clean(row.customer) ||
    clean(scalar(detail.cus_name))
  const tax = gstin(row.companyGST) ?? gstin(detail.gstin_no)
  return {
    name: name || `Legacy Invoice Customer ${clean(row.invoice_no)}`,
    tax,
    key: tax
      ? `GST:${tax}`
      : `NAME:${normalized(name) || `INVOICE-${clean(row.id)}`}`,
  }
}

function description(trip: LegacyTrip) {
  return (
    [trip.vehicle, trip.travelling, trip.localPkg]
      .map((value) => clean(scalar(value)))
      .filter(Boolean)
      .join(' — ')
      .slice(0, 500) || 'Legacy transport service'
  )
}

function tripItem(
  invoiceId: string,
  tenantId: string,
  trip: LegacyTrip,
  index: number,
): PreparedInvoiceItem {
  const amount = money(trip.total_amt)
  const quantityCandidate = money(trip.km)
  const rateCandidate = money(trip.rate)
  const useKm =
    quantityCandidate > 0 &&
    rateCandidate !== 0 &&
    Math.abs(quantityCandidate * rateCandidate - amount) < 0.02
  const quantity = useKm ? quantityCandidate : 1
  const rate = useKm ? rateCandidate : amount
  return {
    id: deterministicUuid(
      `old-invoice-item:${tenantId}:${invoiceId}:trip:${index}`,
    ),
    tenantId,
    invoiceId,
    dateType: optionalServiceDate(trip.use_date) ? 'single' : 'blank',
    serviceDate: optionalServiceDate(trip.use_date),
    serviceStartDate: null,
    serviceEndDate: null,
    description: description(trip),
    quantity,
    unit: useKm ? 'KM' : 'Trip',
    rate,
    amount,
    sortOrder: index,
  }
}

export function prepareInvoiceMigration(
  source: string,
  tenantId: string,
  mappings: InvoiceMigrationMappings,
) {
  if (tenantId !== PRAYAGRAJ_TENANT_ID)
    throw new Error(
      `Invoice source is approved only for Prayagraj tenant ${PRAYAGRAJ_TENANT_ID}`,
    )
  const sourceRows = parseRows(source)
  const byInvoiceNumber = new Map<string, typeof sourceRows>()
  for (const item of sourceRows) {
    const key = clean(item.row.invoice_no)
    byInvoiceNumber.set(key, [...(byInvoiceNumber.get(key) ?? []), item])
  }
  const rejected: InvoiceRejection[] = []
  const removedRows = new Set<number>()
  for (const [number, grouped] of byInvoiceNumber) {
    if (grouped.length < 2) continue
    const ordered = [...grouped].sort(
      (a, b) =>
        parseDate(a.row.issue_date).valueOf() -
          parseDate(b.row.issue_date).valueOf() ||
        Number(a.row.id) - Number(b.row.id),
    )
    for (const duplicate of ordered.slice(1)) {
      removedRows.add(duplicate.rowNumber)
      rejected.push({
        rowNumber: duplicate.rowNumber,
        legacyId: clean(duplicate.row.id),
        invoiceNumber: number,
        bookingReference: clean(duplicate.row.booking_id),
        reason: 'DUPLICATE_INVOICE_NUMBER_REMOVED',
      })
    }
  }

  const bookings = new Map(
    mappings.bookings.map((row) => [row.bookingNumber, row]),
  )
  const bookingCandidates = sourceRows.filter(
    (item) =>
      !removedRows.has(item.rowNumber) &&
      bookings.has(clean(item.row.booking_id)),
  )
  const firstInvoiceForBooking = new Map<string, number>()
  for (const item of bookingCandidates.sort(
    (a, b) =>
      parseDate(a.row.issue_date).valueOf() -
        parseDate(b.row.issue_date).valueOf() ||
      Number(a.row.id) - Number(b.row.id),
  )) {
    const key = clean(item.row.booking_id)
    if (!firstInvoiceForBooking.has(key))
      firstInvoiceForBooking.set(key, item.rowNumber)
  }

  const customersByGstin = new Map<string, InvoiceMigrationCustomer[]>()
  const customersByName = new Map<string, InvoiceMigrationCustomer[]>()
  for (const customer of mappings.customers) {
    if (customer.gstin)
      customersByGstin.set(customer.gstin, [
        ...(customersByGstin.get(customer.gstin) ?? []),
        customer,
      ])
    for (const name of new Set(
      [normalized(customer.name), normalized(customer.billingName)].filter(
        Boolean,
      ),
    ))
      customersByName.set(name, [
        ...(customersByName.get(name) ?? []),
        customer,
      ])
  }
  const placeholders = new Map<string, PreparedInvoiceCustomer>()
  const accepted: PreparedInvoice[] = []

  for (const item of sourceRows) {
    if (removedRows.has(item.rowNumber)) continue
    const { row, rowNumber } = item
    try {
      const invoiceNumber = clean(row.invoice_no)
      if (!invoiceNumber) throw new Error('MISSING_INVOICE_NUMBER')
      const detail = details(row)
      const invoiceDate = parseDate(row.issue_date)
      const sourceBookingReference = clean(row.booking_id)
      const exactBooking = bookings.get(sourceBookingReference)
      const linksBooking = Boolean(
        exactBooking &&
        firstInvoiceForBooking.get(sourceBookingReference) === rowNumber,
      )
      const bookingResolution = linksBooking
        ? 'EXACT_PRIMARY_INVOICE'
        : exactBooking
          ? 'ADDITIONAL_INVOICE_IMPORTED_DIRECT'
          : sourceBookingReference
            ? sourceBookingReference.includes('/')
              ? 'COMPOSITE_IMPORTED_DIRECT'
              : 'UNRESOLVED_IMPORTED_DIRECT'
            : 'BLANK_IMPORTED_DIRECT'
      const identity = invoiceIdentity(row, detail)
      let targetCustomer: InvoiceMigrationCustomer | undefined
      let customerResolution = 'BOOKING_CUSTOMER'
      if (linksBooking)
        targetCustomer = mappings.customers.find(
          (customer) => customer.id === exactBooking!.customerId,
        )
      if (!targetCustomer) {
        const placeholderId = deterministicUuid(
          `old-invoice-placeholder:${tenantId}:${identity.key}`,
        )
        const existingPlaceholder = mappings.customers.find(
          (customer) => customer.id === placeholderId,
        )
        if (existingPlaceholder) {
          targetCustomer = existingPlaceholder
          customerResolution = 'EXISTING_PLACEHOLDER'
          placeholders.set(identity.key, {
            id: placeholderId,
            tenantId,
            customerCode: `LEGACY-INV-${createHash('sha256').update(identity.key).digest('hex').slice(0, 10).toUpperCase()}`,
            type: 'RETAIL',
            name: identity.name.slice(0, 200),
            billingName: identity.name.slice(0, 200),
            phone: `UNKNOWN-INV-${clean(row.id)}`.slice(0, 30),
            city: null,
            gstin: identity.tax,
            billingAddress:
              clean(scalar(detail.address)) || 'Legacy address unavailable',
            status: 'ACTIVE',
            identityKey: identity.key,
          })
        } else {
          const taxMatches = identity.tax
            ? (customersByGstin.get(identity.tax) ?? [])
            : []
          const nameMatches =
            customersByName.get(normalized(identity.name)) ?? []
          const matches =
            taxMatches.length === 1
              ? taxMatches
              : nameMatches.length === 1
                ? nameMatches
                : []
          targetCustomer = matches[0]
          customerResolution =
            taxMatches.length === 1
              ? 'UNIQUE_GSTIN_MATCH'
              : nameMatches.length === 1
                ? 'UNIQUE_NAME_MATCH'
                : 'PLACEHOLDER'
        }
      }
      if (!targetCustomer) {
        let placeholder = placeholders.get(identity.key)
        if (!placeholder) {
          const id = deterministicUuid(
            `old-invoice-placeholder:${tenantId}:${identity.key}`,
          )
          placeholder = {
            id,
            tenantId,
            customerCode: `LEGACY-INV-${createHash('sha256').update(identity.key).digest('hex').slice(0, 10).toUpperCase()}`,
            type: 'RETAIL',
            name: identity.name.slice(0, 200),
            billingName: identity.name.slice(0, 200),
            phone: `UNKNOWN-INV-${clean(row.id)}`.slice(0, 30),
            city: null,
            gstin: identity.tax,
            billingAddress:
              clean(scalar(detail.address)) || 'Legacy address unavailable',
            status: 'ACTIVE',
            identityKey: identity.key,
          }
          placeholders.set(identity.key, placeholder)
        }
        targetCustomer = {
          id: placeholder.id,
          name: placeholder.name,
          billingName: placeholder.billingName,
          gstin: placeholder.gstin,
        }
      }
      const id = deterministicUuid(
        `old-invoices:${tenantId}:${clean(row.id)}:${invoiceNumber}`,
      )
      const cgstAmount = money(detail.cgst)
      const sgstAmount = money(detail.sgst)
      const igstAmount = money(detail.igst)
      const totalGst = cgstAmount + sgstAmount + igstAmount
      const netPayable = money(detail.grand_total)
      const taxableAmount = netPayable - totalGst
      const trips = Array.isArray(detail.trip_details)
        ? (detail.trip_details as LegacyTrip[])
        : []
      const invoiceItems = trips.map((trip, index) =>
        tripItem(id, tenantId, trip, index),
      )
      const charges: Array<[string, number]> = [
        ['Toll tax', money(detail.tollTax)],
        ['Parking', money(detail.parking)],
        ['Driver allowance', money(detail.da)],
        [
          'Service charge',
          money(detail.serviceCharge) || money(row.serviceCharge),
        ],
      ]
      for (const [label, amount] of charges)
        if (amount)
          invoiceItems.push({
            id: deterministicUuid(
              `old-invoice-item:${tenantId}:${id}:charge:${label}`,
            ),
            tenantId,
            invoiceId: id,
            dateType: 'blank',
            serviceDate: null,
            serviceStartDate: null,
            serviceEndDate: null,
            description: label,
            quantity: 1,
            unit: 'Actual',
            rate: amount,
            amount,
            sortOrder: invoiceItems.length,
          })
      const itemTotal = invoiceItems.reduce(
        (sum, invoiceItem) => sum + invoiceItem.amount,
        0,
      )
      const adjustment = Math.round((taxableAmount - itemTotal) * 100) / 100
      if (Math.abs(adjustment) >= 0.01)
        invoiceItems.push({
          id: deterministicUuid(
            `old-invoice-item:${tenantId}:${id}:adjustment`,
          ),
          tenantId,
          invoiceId: id,
          dateType: 'blank',
          serviceDate: null,
          serviceStartDate: null,
          serviceEndDate: null,
          description: 'Legacy reconciliation adjustment',
          quantity: 1,
          unit: 'Actual',
          rate: adjustment,
          amount: adjustment,
          sortOrder: invoiceItems.length,
        })
      if (!invoiceItems.length)
        invoiceItems.push({
          id: deterministicUuid(`old-invoice-item:${tenantId}:${id}:total`),
          tenantId,
          invoiceId: id,
          dateType: 'blank',
          serviceDate: null,
          serviceStartDate: null,
          serviceEndDate: null,
          description: 'Legacy transport service',
          quantity: 1,
          unit: 'Trip',
          rate: taxableAmount,
          amount: taxableAmount,
          sortOrder: 0,
        })
      accepted.push({
        id,
        tenantId,
        bookingId: linksBooking ? exactBooking!.id : null,
        customerId: targetCustomer.id,
        invoiceNumber,
        invoiceSequence: null,
        invoicePrefix: 'LEGACY',
        financialYear: financialYear(invoiceDate),
        invoiceDate,
        status: 'GENERATED',
        gstType: igstAmount
          ? 'IGST'
          : cgstAmount || sgstAmount
            ? 'CGST_SGST'
            : 'NO_GST',
        billingName: identity.name.slice(0, 200),
        billingAddress: (
          clean(scalar(detail.address)) || 'Legacy address unavailable'
        ).slice(0, 2000),
        customerGstin: identity.tax,
        referenceNumber: linksBooking
          ? null
          : sourceBookingReference.slice(0, 150) || null,
        billingType:
          (clean(row.invoiceType) || clean(scalar(detail.invoiceType))).slice(
            0,
            50,
          ) || null,
        billingContact:
          (clean(row.customer) || clean(scalar(detail.cus_name))).slice(
            0,
            200,
          ) || null,
        vehicleDescription: clean(row.vehicle).slice(0, 255) || null,
        displaySnapshot: {
          source: 'legacy_mysql_invoice',
          legacyId: clean(row.id),
          issuedBy: clean(row.issuedBy),
          sourceJson: detail,
          sourceColumns: row,
        },
        subtotal: taxableAmount,
        taxableAmount,
        cgstAmount,
        sgstAmount,
        igstAmount,
        totalGst,
        netPayable,
        generatedAt: invoiceDate,
        legacy: {
          ...row,
          rowNumber,
          bookingResolution,
          customerResolution,
          sourceTotalAmount: money(row.total_amount),
          sourceGrandTotal: netPayable,
          reconciliationAdjustment: adjustment,
        },
        items: invoiceItems,
      })
    } catch (error) {
      rejected.push({
        rowNumber,
        legacyId: clean(row.id),
        invoiceNumber: clean(row.invoice_no),
        bookingReference: clean(row.booking_id),
        reason: error instanceof Error ? error.message : 'INVALID_INVOICE',
      })
    }
  }
  return {
    sourceSha256: createHash('sha256').update(source).digest('hex'),
    sourceRows: sourceRows.length,
    accepted,
    placeholders: [...placeholders.values()],
    rejected,
  }
}
