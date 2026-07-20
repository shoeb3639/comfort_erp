import bookingsSeed from '../data/mock/bookings.json'
import accountsTransactionsSeed from '../data/mock/accountsTransactions.json'
import auditExceptionsSeed from '../data/mock/auditExceptions.json'
import bookingCollectionsSeed from '../data/mock/bookingCollections.json'
import customersSeed from '../data/mock/customers.json'
import bookingCashDepositsSeed from '../data/mock/bookingCashDeposits.json'
import dailyClosingsSeed from '../data/mock/dailyClosings.json'
import driversSeed from '../data/mock/drivers.json'
import driverLedgerEntriesSeed from '../data/mock/driverLedgerEntries.json'
import employeesSeed from '../data/mock/employees.json'
import employeeLedgerEntriesSeed from '../data/mock/employeeLedgerEntries.json'
import expensesSeed from '../data/mock/expenses.json'
import invoicesSeed from '../data/mock/invoices.json'
import gstRegistrationsSeed from '../data/mock/gstRegistrations.json'
import locationsSeed from '../data/mock/locations.json'
import managerLedgerEntriesSeed from '../data/mock/managerLedgerEntries.json'
import officeLedgerEntriesSeed from '../data/mock/officeLedgerEntries.json'
import partnerLedgerEntriesSeed from '../data/mock/partnerLedgerEntries.json'
import managersSeed from '../data/mock/managers.json'
import partnersSeed from '../data/mock/partners.json'
import permissionsSeed from '../data/mock/permissions.json'
import platformAuditLogsSeed from '../data/mock/platformAuditLogs.json'
import platformSupportTicketsSeed from '../data/mock/platformSupportTickets.json'
import platformTenantsSeed from '../data/mock/platformTenants.json'
import platformUsersSeed from '../data/mock/platformUsers.json'
import reconciliationRecordsSeed from '../data/mock/reconciliationRecords.json'
import rolePermissionsSeed from '../data/mock/rolePermissions.json'
import rolesSeed from '../data/mock/roles.json'
import subscriptionPaymentsSeed from '../data/mock/subscriptionPayments.json'
import subscriptionPlansSeed from '../data/mock/subscriptionPlans.json'
import tenantSubscriptionsSeed from '../data/mock/tenantSubscriptions.json'
import travellersSeed from '../data/mock/travellers.json'
import usersSeed from '../data/mock/users.json'
import vehicleLedgerEntriesSeed from '../data/mock/vehicleLedgerEntries.json'
import vehiclesSeed from '../data/mock/vehicles.json'
import vendorsSeed from '../data/mock/vendors.json'

const mockSeeds = {
  accountsTransactions: accountsTransactionsSeed,
  auditExceptions: auditExceptionsSeed,
  bookingCollections: bookingCollectionsSeed,
  bookingCashDeposits: bookingCashDepositsSeed,
  bookings: bookingsSeed,
  customers: customersSeed,
  dailyClosings: dailyClosingsSeed,
  drivers: driversSeed,
  driverLedgerEntries: driverLedgerEntriesSeed,
  employees: employeesSeed,
  employeeLedgerEntries: employeeLedgerEntriesSeed,
  expenses: expensesSeed,
  gstRegistrations: gstRegistrationsSeed,
  invoices: invoicesSeed,
  locations: locationsSeed,
  managerLedgerEntries: managerLedgerEntriesSeed,
  officeLedgerEntries: officeLedgerEntriesSeed,
  partnerLedgerEntries: partnerLedgerEntriesSeed,
  managers: managersSeed,
  partners: partnersSeed,
  permissions: permissionsSeed,
  platformAuditLogs: platformAuditLogsSeed,
  platformSupportTickets: platformSupportTicketsSeed,
  platformTenants: platformTenantsSeed,
  platformUsers: platformUsersSeed,
  reconciliationRecords: reconciliationRecordsSeed,
  rolePermissions: rolePermissionsSeed,
  roles: rolesSeed,
  subscriptionPayments: subscriptionPaymentsSeed,
  subscriptionPlans: subscriptionPlansSeed,
  tenantSubscriptions: tenantSubscriptionsSeed,
  travellers: travellersSeed,
  users: usersSeed,
  vehicleLedgerEntries: vehicleLedgerEntriesSeed,
  vehicles: vehiclesSeed,
  vendors: vendorsSeed,
}

const storagePrefix = 'booking_admin_mock_v6_'

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function canUseStorage() {
  return typeof window !== 'undefined' && Boolean(window.localStorage)
}

export function getMockData(collection) {
  const seed = mockSeeds[collection] || []

  if (!canUseStorage()) {
    return clone(seed)
  }

  const storageKey = `${storagePrefix}${collection}`
  const storedValue = window.localStorage.getItem(storageKey)

  if (!storedValue) {
    window.localStorage.setItem(storageKey, JSON.stringify(seed))
    return clone(seed)
  }

  try {
    return JSON.parse(storedValue)
  } catch {
    window.localStorage.setItem(storageKey, JSON.stringify(seed))
    return clone(seed)
  }
}

export function saveMockData(collection, records) {
  if (canUseStorage()) {
    window.localStorage.setItem(`${storagePrefix}${collection}`, JSON.stringify(records))
  }

  return records
}

export function createMockRecord(collection, record) {
  const records = getMockData(collection)
  const nextRecords = [record, ...records]
  saveMockData(collection, nextRecords)
  return record
}

export function updateMockRecord(collection, id, updates) {
  const records = getMockData(collection)
  const nextRecords = records.map((record) => (record.id === id ? { ...record, ...updates } : record))
  saveMockData(collection, nextRecords)
  return nextRecords.find((record) => record.id === id)
}

export function deleteMockRecord(collection, id) {
  const records = getMockData(collection)
  const nextRecords = records.filter((record) => record.id !== id)
  saveMockData(collection, nextRecords)
  return nextRecords
}

export function resetMockData(collection) {
  if (canUseStorage()) {
    window.localStorage.removeItem(`${storagePrefix}${collection}`)
  }

  return getMockData(collection)
}

export const bookings = clone(bookingsSeed)
export const accountsTransactions = clone(accountsTransactionsSeed)
export const auditExceptions = clone(auditExceptionsSeed)
export const bookingCollections = clone(bookingCollectionsSeed)
export const bookingCashDeposits = clone(bookingCashDepositsSeed)
export const customers = clone(customersSeed)
export const dailyClosings = clone(dailyClosingsSeed)
export const drivers = clone(driversSeed)
export const driverLedgerEntries = clone(driverLedgerEntriesSeed)
export const employees = clone(employeesSeed)
export const employeeLedgerEntries = clone(employeeLedgerEntriesSeed)
export const expenses = clone(expensesSeed)
export const gstRegistrations = clone(gstRegistrationsSeed)
export const invoices = clone(invoicesSeed)
export const locations = clone(locationsSeed)
export const managerLedgerEntries = clone(managerLedgerEntriesSeed)
export const officeLedgerEntries = clone(officeLedgerEntriesSeed)
export const partnerLedgerEntries = clone(partnerLedgerEntriesSeed)
export const managers = clone(managersSeed)
export const partners = clone(partnersSeed)
export const permissions = clone(permissionsSeed)
export const platformAuditLogs = clone(platformAuditLogsSeed)
export const platformSupportTickets = clone(platformSupportTicketsSeed)
export const platformTenants = clone(platformTenantsSeed)
export const platformUsers = clone(platformUsersSeed)
export const reconciliationRecords = clone(reconciliationRecordsSeed)
export const rolePermissions = clone(rolePermissionsSeed)
export const roles = clone(rolesSeed)
export const subscriptionPayments = clone(subscriptionPaymentsSeed)
export const subscriptionPlans = clone(subscriptionPlansSeed)
export const tenantSubscriptions = clone(tenantSubscriptionsSeed)
export const travellers = clone(travellersSeed)
export const users = clone(usersSeed)
export const vehicleLedgerEntries = clone(vehicleLedgerEntriesSeed)
export const vehicles = clone(vehiclesSeed)
export const vendors = clone(vendorsSeed)
