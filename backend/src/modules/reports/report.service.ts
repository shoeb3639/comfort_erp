import type { ReportFilters } from './report.repository'
import * as repository from './report.repository'
import type { ReportKey } from './report.schema'

const catalog = [
  [
    'business-summary',
    'Business Summary',
    'Executive overview of operations and finance.',
  ],
  ['booking-register', 'Booking Register', 'Detailed tenant booking activity.'],
  [
    'invoice-register',
    'Invoice Register',
    'Draft, generated, and cancelled invoices.',
  ],
  [
    'outstanding-invoices',
    'Outstanding Invoices',
    'Generated value not covered by collections.',
  ],
  [
    'expense-register',
    'Expense Register',
    'Posted operational expense transactions.',
  ],
  [
    'vehicle-utilization',
    'Vehicle Utilization',
    'Own-fleet duty and running performance.',
  ],
  [
    'vendor-duty',
    'Vendor Duty Report',
    'Vendor-assigned duties and payable economics.',
  ],
] as const

function date(value: Date | null | undefined) {
  return value?.toISOString().slice(0, 10) || ''
}

function number(value: unknown) {
  return Number(value || 0)
}

function page(total: number, filters: ReportFilters) {
  return {
    page: filters.page,
    limit: filters.limit,
    total,
    pages: Math.max(1, Math.ceil(total / filters.limit)),
  }
}

async function bookingReport(
  tenantId: string,
  filters: ReportFilters,
  vendorOnly = false,
) {
  const result = await repository.bookings(tenantId, {
    ...filters,
    ...(vendorOnly ? { assignmentSource: 'VENDOR' } : {}),
  })
  const rows = result.rows
    .filter((row) => !vendorOnly || row.vendorId)
    .map((row) => ({
      id: row.id,
      bookingNumber: row.bookingNumber,
      serviceDate: date(row.startDate),
      customer: row.customer.billingName,
      route:
        [row.travellingFrom, row.travellingTo].filter(Boolean).join(' → ') ||
        row.serviceCity,
      assignmentSource: row.assignmentSource,
      vendor: row.vendor?.name || '',
      vehicle: row.vehicle?.registrationNumber || '',
      driver: row.driver?.name || '',
      status: row.status,
      revenue: number(row.closure?.totalBillAmount || row.customerRate),
      vendorPayable: number(
        row.closure?.finalVendorPayable || row.vendorPayableAmount,
      ),
      margin: number(row.closure?.vendorBookingProfit),
    }))
  return {
    rows,
    summary: vendorOnly
      ? {
          duties: result.total,
          revenue: rows.reduce((sum, row) => sum + row.revenue, 0),
          vendorPayable: rows.reduce((sum, row) => sum + row.vendorPayable, 0),
          margin: rows.reduce((sum, row) => sum + row.margin, 0),
        }
      : {
          bookings: result.total,
          revenue: rows.reduce((sum, row) => sum + row.revenue, 0),
          ownDuties: rows.filter((row) => row.assignmentSource === 'OWN')
            .length,
          vendorDuties: rows.filter((row) => row.assignmentSource === 'VENDOR')
            .length,
        },
    pagination: page(result.total, filters),
  }
}

async function invoiceReport(
  tenantId: string,
  filters: ReportFilters,
  outstandingOnly = false,
) {
  const result = await repository.invoices(tenantId, {
    ...filters,
    ...(outstandingOnly ? { status: 'GENERATED' } : {}),
  })
  const mapped = result.rows.map((row) => {
    const collected = row.collections.reduce(
      (sum, collection) => sum + number(collection.amount),
      0,
    )
    return {
      id: row.id,
      invoiceNumber: row.invoiceNumber || 'Draft',
      invoiceDate: date(row.invoiceDate),
      bookingNumber: row.booking?.bookingNumber || '',
      customer: row.billingName,
      taxableAmount: number(row.taxableAmount),
      gst: number(row.totalGst),
      netPayable: number(row.netPayable),
      collected,
      outstanding: Math.max(0, number(row.netPayable) - collected),
      status: row.status,
    }
  })
  const rows = outstandingOnly
    ? mapped.filter((row) => row.outstanding > 0)
    : mapped
  return {
    rows,
    summary: {
      invoices: rows.length,
      netPayable: rows.reduce((sum, row) => sum + row.netPayable, 0),
      collected: rows.reduce((sum, row) => sum + row.collected, 0),
      outstanding: rows.reduce((sum, row) => sum + row.outstanding, 0),
    },
    pagination: page(outstandingOnly ? rows.length : result.total, filters),
  }
}

async function expenseReport(tenantId: string, filters: ReportFilters) {
  const result = await repository.expenses(tenantId, filters)
  const rows = result.rows.map((row) => ({
    id: row.id,
    transactionDate: date(row.transactionDate),
    manager: row.ledger.manager.name,
    location: row.ledger.location.name,
    category: row.category || 'OTHER',
    description: row.description,
    paymentMode: row.paymentMode,
    referenceNumber: row.referenceNumber,
    amount: number(row.amount),
  }))
  return {
    rows,
    summary: {
      expenses: result.total,
      totalAmount: rows.reduce((sum, row) => sum + row.amount, 0),
      categories: new Set(rows.map((row) => row.category)).size,
    },
    pagination: page(result.total, filters),
  }
}

async function utilizationReport(tenantId: string, filters: ReportFilters) {
  const vehicles = await repository.vehicles(tenantId, filters)
  const rows = vehicles.map((vehicle) => {
    const duties = vehicle.bookings
    const completed = duties.filter((row) =>
      ['COMPLETED', 'CLOSED'].includes(row.status),
    )
    const runningKm = completed.reduce(
      (sum, row) => sum + number(row.closure?.actualRunningKm),
      0,
    )
    return {
      id: vehicle.id,
      registrationNumber: vehicle.registrationNumber,
      vehicleType: vehicle.vehicleType.name,
      status: vehicle.status,
      duties: duties.length,
      completedDuties: completed.length,
      runningKm,
      revenue: completed.reduce(
        (sum, row) => sum + number(row.closure?.vehicleRevenue),
        0,
      ),
      utilizationRate: duties.length
        ? Math.round((completed.length / duties.length) * 100)
        : 0,
    }
  })
  return {
    rows,
    summary: {
      vehicles: rows.length,
      duties: rows.reduce((sum, row) => sum + row.duties, 0),
      runningKm: rows.reduce((sum, row) => sum + row.runningKm, 0),
      revenue: rows.reduce((sum, row) => sum + row.revenue, 0),
    },
    pagination: {
      page: 1,
      limit: rows.length,
      total: rows.length,
      pages: 1,
    },
  }
}

export function getCatalog() {
  return catalog.map(([key, name, description]) => ({
    key,
    name,
    description,
  }))
}

export async function getOptions(tenantId: string) {
  const [customers, vendors, vehicles] =
    await repository.reportOptions(tenantId)
  return { customers, vendors, vehicles }
}

export async function generate(
  tenantId: string,
  reportKey: ReportKey,
  filters: ReportFilters,
) {
  let report
  switch (reportKey) {
    case 'booking-register':
      report = await bookingReport(tenantId, filters)
      break
    case 'invoice-register':
      report = await invoiceReport(tenantId, filters)
      break
    case 'outstanding-invoices':
      report = await invoiceReport(tenantId, filters, true)
      break
    case 'expense-register':
      report = await expenseReport(tenantId, filters)
      break
    case 'vehicle-utilization':
      report = await utilizationReport(tenantId, filters)
      break
    case 'vendor-duty':
      report = await bookingReport(tenantId, filters, true)
      break
    case 'business-summary': {
      const [bookings, invoices, outstanding, expenses, utilization, vendors] =
        await Promise.all([
          bookingReport(tenantId, filters),
          invoiceReport(tenantId, filters),
          invoiceReport(tenantId, filters, true),
          expenseReport(tenantId, filters),
          utilizationReport(tenantId, filters),
          bookingReport(tenantId, filters, true),
        ])
      report = {
        rows: [],
        summary: {
          bookings: bookings.summary.bookings,
          bookingRevenue: bookings.summary.revenue,
          invoicedRevenue: invoices.summary.netPayable,
          collected: invoices.summary.collected,
          outstanding: outstanding.summary.outstanding,
          expenses: expenses.summary.totalAmount,
          ownVehicles: utilization.summary.vehicles,
          vendorDuties: vendors.summary.duties,
        },
        pagination: { page: 1, limit: 0, total: 0, pages: 1 },
      }
      break
    }
  }
  const definition = getCatalog().find((item) => item.key === reportKey)!
  return {
    report: definition,
    filters,
    generatedAt: new Date().toISOString(),
    ...report,
  }
}
