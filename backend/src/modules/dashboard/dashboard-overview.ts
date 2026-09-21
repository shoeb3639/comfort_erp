import { tenantBusinessDate } from '../../shared/date/tenant-business-date'
import * as accountOperations from '../accounts/accounts.operations'
import * as accounts from '../accounts/accounts.service'
import * as bookings from '../bookings/booking.service'
import * as companySetup from '../company-setup/company-setup.service'
import * as customers from '../customers/customer.service'
import * as drivers from '../drivers/driver.service'
import * as invoices from '../invoices/invoice.service'
import { cardMetric, metricKeys } from './card-metrics'
import { outstandingCustomers } from './outstanding-customers'
import { vehiclePerformance } from './vehicle-performance'

export interface DashboardOverviewContext {
  tenantId: string
  userId: string
}

/**
 * The dashboard is intentionally assembled on the server. It replaces the
 * many independent browser requests that previously fetched this same data.
 */
export async function dashboardOverview(context: DashboardOverviewContext) {
  const companyProfile = await companySetup.getCompanyProfile(context)
  const businessDate = tenantBusinessDate(companyProfile.timeZone)
  const monthStart = `${businessDate.slice(0, 7)}-01`
  const page = { page: 1, limit: 100 }

  const [
    bookingData,
    customerData,
    invoiceData,
    transactions,
    cashDeposits,
    managerLedgers,
    audit,
    driverData,
    layout,
    outstanding,
    defaultVehiclePerformance,
    cardValues,
  ] = await Promise.all([
    bookings.list(context, page),
    customers.listCustomers(context, page),
    invoices.list(context, page),
    accountOperations.listTransactions(context.tenantId, page),
    accounts.listCashDeposits(context.tenantId, page),
    accounts.listManagerLedgers(context.tenantId, {}),
    accountOperations.getAudit(context.tenantId),
    drivers.listDrivers(context, page),
    companySetup.getDashboardLayout(context),
    outstandingCustomers(context.tenantId, businessDate),
    vehiclePerformance(context.tenantId, 'OWN', monthStart, businessDate),
    Promise.all(
      metricKeys.map((metric) =>
        cardMetric(context.tenantId, metric, monthStart, businessDate),
      ),
    ),
  ])

  return {
    businessDate,
    bookings: bookingData,
    customers: customerData,
    invoices: invoiceData,
    transactions,
    cashDeposits,
    managerLedgers,
    audit,
    drivers: driverData,
    companyProfile,
    layout,
    outstanding,
    vehiclePerformance: defaultVehiclePerformance,
    cardMetrics: Object.fromEntries(
      cardValues.map((value) => [value.metric, value]),
    ),
  }
}
