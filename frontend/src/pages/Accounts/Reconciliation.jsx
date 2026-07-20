import { useMemo, useState } from 'react'
import { getMockData, saveMockData } from '../../services/api'
import {
  Section,
  SummaryCard,
  TableShell,
  fieldClass,
  money,
  toNumber,
} from './accountUtils'

function AuditStatusBadge({ status }) {
  const tone =
    ['Matched', 'Verified', 'Resolved'].includes(status)
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
      : ['Pending Verification', 'Pending Deposit', 'Pending'].includes(status)
        ? 'bg-amber-50 text-amber-700 ring-amber-600/20'
        : ['Mismatch', 'Critical', 'Open'].includes(status)
          ? 'bg-rose-50 text-rose-700 ring-rose-600/20'
          : 'bg-slate-100 text-slate-700 ring-slate-500/20'

  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${tone}`}>{status}</span>
}

function SeverityBadge({ severity }) {
  const tone =
    severity === 'Critical'
      ? 'bg-rose-100 text-rose-800 ring-rose-700/20'
      : severity === 'High'
        ? 'bg-rose-50 text-rose-700 ring-rose-600/20'
        : severity === 'Medium'
          ? 'bg-amber-50 text-amber-700 ring-amber-600/20'
          : 'bg-slate-100 text-slate-700 ring-slate-500/20'

  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${tone}`}>{severity}</span>
}

function getLedgerVerificationStatus(difference, hasPending) {
  if (hasPending) return 'Pending Verification'
  if (Math.abs(difference) > 0) return 'Mismatch'
  return 'Matched'
}

function getBookingCashStatus(cashCollected, cashDeposited) {
  if (cashDeposited <= 0) return 'Pending Deposit'
  if (cashDeposited !== cashCollected) return 'Mismatch'
  return 'Verified'
}

function getExceptionSeverity(type, amount) {
  if (['Negative Fund Balance', 'Excess Expense Beyond Fund Balance', 'Cash Not Deposited'].includes(type)) return 'Critical'
  if (amount >= 5000 || ['Fund Balance Mismatch', 'Duplicate Reference Number'].includes(type)) return 'High'
  if (['Deposit Not Verified', 'Missing Vehicle in Vehicle Expense', 'Missing Driver in Driver Payment'].includes(type)) return 'Medium'
  return 'Low'
}

function isCredit(type) {
  return type === 'Fund Release' || type === 'Driver Recovery'
}

function AuditVerificationPage() {
  const transactions = useMemo(() => getMockData('accountsTransactions'), [])
  const ledgerEntries = useMemo(() => getMockData('managerLedgerEntries'), [])
  const deposits = useMemo(() => getMockData('bookingCashDeposits'), [])
  const managers = useMemo(() => getMockData('managers'), [])
  const locations = useMemo(() => getMockData('locations'), [])
  const [exceptions, setExceptions] = useState(() => getMockData('auditExceptions'))
  const [filters, setFilters] = useState({
    dateFrom: '2026-07-01',
    dateTo: '2026-07-07',
    manager: 'All',
    location: 'All',
    search: '',
  })

  const filteredManagers = managers.filter(
    (manager) =>
      (!filters.manager || filters.manager === 'All' || manager.name === filters.manager) &&
      (!filters.location || filters.location === 'All' || manager.location === filters.location),
  )

  const managerRows = filteredManagers.map((manager) => {
    const managerTransactions = transactions.filter((transaction) => transaction.manager === manager.name)
    const managerEntries = ledgerEntries.filter((entry) => entry.manager === manager.name)
    const openingBalance = toNumber(managerEntries.find((entry) => entry.transactionType === 'Opening Balance')?.runningBalance)
    const fundReleased = managerTransactions
      .filter((transaction) => transaction.transactionType === 'Fund Release')
      .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0)
    const expenses = managerTransactions
      .filter((transaction) => !isCredit(transaction.transactionType))
      .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0)
    const expectedBalance = openingBalance + fundReleased - expenses
    const actualBalance = managerEntries.at(-1)?.runningBalance ?? expectedBalance
    const difference = actualBalance - expectedBalance

    return {
      id: manager.id,
      manager: manager.name,
      openingBalance,
      fundReleased,
      expensesSubmitted: expenses,
      expectedBalance,
      actualBalance,
      difference,
      status: getLedgerVerificationStatus(
        difference,
        managerTransactions.some((transaction) => transaction.status === 'Pending Verification'),
      ),
    }
  })

  const bookingCashRows = deposits.map((deposit) => {
    const cashCollected = toNumber(deposit.amountCollected)
    const cashDeposited = ['Deposited', 'Verified'].includes(deposit.depositStatus) ? toNumber(deposit.depositedAmount || deposit.amountCollected) : 0
    const difference = cashCollected - cashDeposited

    return {
      id: deposit.id,
      bookingId: deposit.bookingId,
      customer: deposit.customer,
      cashCollected,
      cashDeposited,
      depositReference: deposit.depositReferenceNumber,
      difference,
      status: getBookingCashStatus(cashCollected, cashDeposited),
    }
  })

  const derivedExceptions = [
    ...exceptions.map((item) => ({
      id: item.id,
      date: item.date || '2026-07-06',
      type: item.type,
      reference: item.reference || item.referenceNumber || item.bookingId || item.fundNo || item.id,
      description: item.description,
      severity: item.severity || getExceptionSeverity(item.type, toNumber(item.amount)),
      status: item.status === 'Verified' ? 'Resolved' : item.status || 'Open',
    })),
    ...transactions
      .filter((transaction) => transaction.category === 'Fuel' && !transaction.vehicle)
      .map((transaction) => ({
        id: `AUTO-FUEL-VEHICLE-${transaction.id}`,
        date: transaction.transactionDate,
        type: 'Fuel Expense Without Vehicle',
        reference: transaction.id,
        description: 'Fuel expense requires vehicle reference.',
        severity: 'High',
        status: 'Open',
      })),
    ...transactions
      .filter((transaction) => transaction.category === 'Recoverable Trip Charge' && !transaction.bookingId)
      .map((transaction) => ({
        id: `AUTO-RECOVERABLE-${transaction.id}`,
        date: transaction.transactionDate,
        type: 'Recoverable Charge Not Linked to Booking',
        reference: transaction.id,
        description: 'Recoverable toll/parking/state tax must be linked to booking.',
        severity: 'High',
        status: 'Open',
      })),
    ...transactions
      .filter((transaction) => transaction.category === 'Fuel' && !transaction.bookingId)
      .map((transaction) => ({
        id: `AUTO-FUEL-${transaction.id}`,
        date: transaction.transactionDate,
        type: 'Missing Booking Reference in Fuel Expense',
        reference: transaction.id,
        description: 'Fuel expense is missing booking reference.',
        severity: 'Medium',
        status: 'Open',
      })),
    ...transactions
      .filter((transaction) => transaction.category === 'Vehicle Service / Maintenance' && !transaction.vehicle)
      .map((transaction) => ({
        id: `AUTO-VEHICLE-${transaction.id}`,
        date: transaction.transactionDate,
        type: 'Missing Vehicle in Vehicle Expense',
        reference: transaction.id,
        description: 'Vehicle expense requires vehicle reference.',
        severity: 'Medium',
        status: 'Open',
      })),
    ...transactions
      .filter((transaction) => transaction.category === 'Driver Payment' && !transaction.driver)
      .map((transaction) => ({
        id: `AUTO-DRIVER-${transaction.id}`,
        date: transaction.transactionDate,
        type: 'Missing Driver in Driver Payment',
        reference: transaction.id,
        description: 'Driver payment requires driver reference.',
        severity: 'Medium',
        status: 'Open',
      })),
    ...transactions
      .filter((transaction) => transaction.category === 'Office Expense' && !transaction.allocationMethod)
      .map((transaction) => ({
        id: `AUTO-OFFICE-${transaction.id}`,
        date: transaction.transactionDate,
        type: 'Office Expense Without Allocation Method',
        reference: transaction.id,
        description: 'Office expense requires allocation method for month-end reporting.',
        severity: 'Medium',
        status: 'Open',
      })),
  ]

  const duplicateReferences = [...deposits.map((deposit) => deposit.depositReferenceNumber), ...transactions.map((transaction) => transaction.referenceNumber)]
    .filter(Boolean)
    .filter((reference, index, references) => references.indexOf(reference) !== index)
  const duplicateExceptions = Array.from(new Set(duplicateReferences)).map((reference) => ({
    id: `AUTO-DUP-${reference}`,
    date: '2026-07-06',
    type: 'Duplicate Reference Number',
    reference,
    description: 'Same deposit reference number appears more than once.',
    severity: 'High',
    status: 'Open',
  }))

  const allExceptions = [...derivedExceptions, ...duplicateExceptions].filter((item) =>
    [item.type, item.reference, item.description, item.severity, item.status]
      .join(' ')
      .toLowerCase()
      .includes(filters.search.trim().toLowerCase()),
  )

  const auditTrail = [
    { id: 'AT-001', date: '2026-07-06 18:20', user: 'Pooja Mishra', action: 'Deposit Verified', module: 'Booking Cash Deposit', reference: 'BCD-1002' },
    { id: 'AT-002', date: '2026-07-06 17:45', user: 'Admin', action: 'Fund Released', module: 'Manager Ledger', reference: 'UPI-FUND-20001', remarks: 'Company fund credited to manager ledger' },
    { id: 'AT-003', date: '2026-07-06 15:10', user: 'Syed Tarique', action: 'Expense Edited', module: 'Transactions', reference: 'TXN-1002', remarks: 'Fuel expense updated' },
    { id: 'AT-004', date: '2026-07-05 20:00', user: 'Syed Tarique', action: 'Balance Adjusted', module: 'Daily Closing', reference: 'DC-20260706-MGR001', remarks: 'Carry-forward reviewed' },
  ]

  const totalFundReleased = managerRows.reduce((sum, row) => sum + row.fundReleased, 0)
  const totalExpenses = managerRows.reduce((sum, row) => sum + row.expensesSubmitted, 0)
  const pendingDepositAmount = bookingCashRows
    .filter((row) => row.status !== 'Verified')
    .reduce((sum, row) => sum + row.difference, 0)
  const mismatchAmount =
    managerRows.reduce((sum, row) => sum + Math.abs(row.difference), 0) +
    bookingCashRows.filter((row) => row.status === 'Mismatch').reduce((sum, row) => sum + Math.abs(row.difference), 0)
  const unverifiedTransactions =
    managerRows.filter((row) => row.status !== 'Matched').length +
    bookingCashRows.filter((row) => row.status !== 'Verified').length +
    allExceptions.filter((item) => item.status !== 'Resolved').length

  function updateFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }))
  }

  function updateExceptionStatus(id, status) {
    const nextExceptions = exceptions.map((item) => (item.id === id ? { ...item, status } : item))
    saveMockData('auditExceptions', nextExceptions)
    setExceptions(nextExceptions)
  }

  function addAdjustment(id) {
    const nextExceptions = exceptions.map((item) =>
      item.id === id ? { ...item, status: 'Review', description: `${item.description} | Adjustment noted` } : item,
    )
    saveMockData('auditExceptions', nextExceptions)
    setExceptions(nextExceptions)
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[180px_180px_1fr_1fr_1.2fr]">
          <label>
            <span className="text-sm font-medium text-slate-700">Date From</span>
            <input className={fieldClass} type="date" value={filters.dateFrom} onChange={(event) => updateFilter('dateFrom', event.target.value)} />
          </label>
          <label>
            <span className="text-sm font-medium text-slate-700">Date To</span>
            <input className={fieldClass} type="date" value={filters.dateTo} onChange={(event) => updateFilter('dateTo', event.target.value)} />
          </label>
          <label>
            <span className="text-sm font-medium text-slate-700">Manager</span>
            <select className={fieldClass} value={filters.manager} onChange={(event) => updateFilter('manager', event.target.value)}>
              <option>All</option>
              {managers.map((manager) => <option key={manager.id}>{manager.name}</option>)}
            </select>
          </label>
          <label>
            <span className="text-sm font-medium text-slate-700">Location</span>
            <select className={fieldClass} value={filters.location} onChange={(event) => updateFilter('location', event.target.value)}>
              <option>All</option>
              {locations.map((location) => <option key={location.id}>{location.name}</option>)}
            </select>
          </label>
          <label>
            <span className="text-sm font-medium text-slate-700">Search</span>
            <input className={fieldClass} value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Search exceptions, references, status" />
          </label>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Total Fund Released" value={totalFundReleased} />
        <SummaryCard label="Total Expenses" value={totalExpenses} tone="warning" />
        <SummaryCard label="Pending Deposit Amount" value={pendingDepositAmount} tone={pendingDepositAmount > 0 ? 'danger' : 'success'} />
        <SummaryCard label="Mismatch Amount" value={mismatchAmount} tone={mismatchAmount > 0 ? 'danger' : 'success'} />
        <SummaryCard label="Unverified Transactions" value={unverifiedTransactions} prefix="" tone={unverifiedTransactions > 0 ? 'warning' : 'success'} />
      </div>

      <Section title="Pending Actions">
        <div className="grid gap-4 md:grid-cols-4">
          <SummaryCard label="Pending Deposits" value={bookingCashRows.filter((row) => row.status === 'Pending Deposit').length} prefix="" tone="warning" />
          <SummaryCard label="Pending Fund Verification" value={managerRows.filter((row) => row.status === 'Pending Verification').length} prefix="" tone="warning" />
          <SummaryCard label="Pending Exceptions" value={allExceptions.filter((item) => item.status !== 'Resolved').length} prefix="" tone="danger" />
          <SummaryCard label="Critical Issues" value={allExceptions.filter((item) => item.severity === 'Critical' && item.status !== 'Resolved').length} prefix="" tone="danger" />
        </div>
      </Section>

      <Section
        title="Manager Ledger Verification"
        actions={
          <div className="flex flex-wrap gap-2">
            <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Export Excel</button>
            <button className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Export PDF</button>
          </div>
        }
      >
        <TableShell columns={['Manager', 'Opening Balance', 'Fund Released', 'Expenses Submitted', 'Expected Balance', 'Actual Balance', 'Difference', 'Status']} minWidth="1100px" empty={managerRows.length === 0}>
          {managerRows.map((row) => (
            <tr key={row.id}>
              <td className="px-4 py-3 font-semibold text-slate-900">{row.manager}</td>
              <td className="px-4 py-3 text-slate-600">₹ {money(row.openingBalance)}</td>
              <td className="px-4 py-3 text-slate-600">₹ {money(row.fundReleased)}</td>
              <td className="px-4 py-3 text-slate-600">₹ {money(row.expensesSubmitted)}</td>
              <td className="px-4 py-3 text-slate-600">₹ {money(row.expectedBalance)}</td>
              <td className="px-4 py-3 text-slate-600">₹ {money(row.actualBalance)}</td>
              <td className="px-4 py-3 font-semibold text-slate-900">₹ {money(row.difference)}</td>
              <td className="px-4 py-3"><AuditStatusBadge status={row.status} /></td>
            </tr>
          ))}
        </TableShell>
      </Section>

      <Section title="Booking Cash Verification">
        <TableShell columns={['Booking ID', 'Customer', 'Cash Collected', 'Cash Deposited', 'Deposit Reference', 'Difference', 'Status']} minWidth="1000px" empty={bookingCashRows.length === 0}>
          {bookingCashRows.map((row) => (
            <tr key={row.id}>
              <td className="px-4 py-3 font-semibold text-slate-900">{row.bookingId}</td>
              <td className="px-4 py-3 text-slate-600">{row.customer}</td>
              <td className="px-4 py-3 text-slate-600">₹ {money(row.cashCollected)}</td>
              <td className="px-4 py-3 text-slate-600">₹ {money(row.cashDeposited)}</td>
              <td className="px-4 py-3 text-slate-600">{row.depositReference || '-'}</td>
              <td className="px-4 py-3 font-semibold text-slate-900">₹ {money(row.difference)}</td>
              <td className="px-4 py-3"><AuditStatusBadge status={row.status} /></td>
            </tr>
          ))}
        </TableShell>
      </Section>

      <Section title="Exception Report">
        <TableShell columns={['Date', 'Exception Type', 'Reference', 'Description', 'Severity', 'Status', 'Actions']} minWidth="1200px" empty={allExceptions.length === 0}>
          {allExceptions.map((item) => (
            <tr key={item.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 text-slate-600">{item.date}</td>
              <td className="px-4 py-3 font-semibold text-slate-900">{item.type}</td>
              <td className="px-4 py-3 text-slate-600">{item.reference}</td>
              <td className="px-4 py-3 text-slate-600">{item.description}</td>
              <td className="px-4 py-3"><SeverityBadge severity={item.severity} /></td>
              <td className="px-4 py-3"><AuditStatusBadge status={item.status} /></td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50" type="button" onClick={() => updateExceptionStatus(item.id, 'Verified')}>
                    Verify
                  </button>
                  <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50" type="button" onClick={() => updateExceptionStatus(item.id, 'Resolved')}>
                    Mark Resolved
                  </button>
                  <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50" type="button" onClick={() => addAdjustment(item.id)}>
                    Add Adjustment
                  </button>
                  <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50" type="button">
                    View Details
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </TableShell>
      </Section>

      <Section title="Audit Trail">
        <TableShell columns={['Date', 'User', 'Action', 'Module', 'Reference', 'Remarks']} minWidth="950px" empty={auditTrail.length === 0}>
          {auditTrail.map((item) => (
            <tr key={item.id}>
              <td className="px-4 py-3 text-slate-600">{item.date}</td>
              <td className="px-4 py-3 font-semibold text-slate-900">{item.user}</td>
              <td className="px-4 py-3 text-slate-600">{item.action}</td>
              <td className="px-4 py-3 text-slate-600">{item.module}</td>
              <td className="px-4 py-3 text-slate-600">{item.reference}</td>
              <td className="px-4 py-3 text-slate-600">{item.remarks || '-'}</td>
            </tr>
          ))}
        </TableShell>
      </Section>
    </div>
  )
}

export default AuditVerificationPage
