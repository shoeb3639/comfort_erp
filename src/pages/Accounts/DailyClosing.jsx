import { useMemo, useState } from 'react'
import { getMockData, saveMockData } from '../../services/api'
import { Section, StatusBadge, SummaryCard, TableShell, fieldClass, money, toNumber } from './accountUtils'

function isCredit(type) {
  return type === 'Fund Release' || type === 'Driver Recovery'
}

function DailyClosingPage() {
  const [closings, setClosings] = useState(() => getMockData('dailyClosings'))
  const transactions = useMemo(() => getMockData('accountsTransactions'), [])
  const ledgerEntries = useMemo(() => getMockData('managerLedgerEntries'), [])
  const deposits = useMemo(() => getMockData('bookingCashDeposits'), [])
  const managers = useMemo(() => getMockData('managers'), [])
  const locations = useMemo(() => getMockData('locations'), [])
  const [filters, setFilters] = useState({
    date: '2026-07-06',
    manager: 'Syed Tarique',
    location: 'Prayagraj',
  })

  const closing = closings.find(
    (item) => item.date === filters.date && item.managerName === filters.manager && item.location === filters.location,
  )
  const openingEntry = ledgerEntries.find(
    (entry) => entry.date === filters.date && entry.manager === filters.manager && entry.transactionType === 'Opening Balance',
  )
  const openingBalance = toNumber(closing?.openingBalance ?? openingEntry?.runningBalance)
  const transactionsToday = transactions.filter(
    (transaction) =>
      transaction.transactionDate === filters.date &&
      transaction.manager === filters.manager &&
      (!filters.location || transaction.location === filters.location),
  )
  const amountReleased = transactionsToday
    .filter((transaction) => transaction.transactionType === 'Fund Release')
    .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0)
  const expensesToday = transactionsToday
    .filter((transaction) => ['Expense', 'Driver Advance', 'Partner Withdrawal', 'Owner Withdrawal', 'Employee Advance'].includes(transaction.transactionType))
    .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0)
  const fundReturned = transactionsToday
    .filter((transaction) => transaction.transactionType === 'Fund Return')
    .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0)
  const adjustments = transactionsToday
    .filter((transaction) => transaction.transactionType === 'Adjustment')
    .reduce((sum, transaction) => sum + (isCredit(transaction.transactionType) ? toNumber(transaction.amount) : -toNumber(transaction.amount)), 0)
  const closingBalance = openingBalance + amountReleased - expensesToday - fundReturned + adjustments
  const bookingCashDepositsToday = deposits.filter(
    (deposit) =>
      (deposit.collectionDate === filters.date || deposit.depositDate === filters.date) &&
      (!filters.manager || deposit.receivedByManager === filters.manager),
  )
  const cashDepositPending = bookingCashDepositsToday
    .filter((deposit) => deposit.depositStatus !== 'Verified')
    .reduce((sum, deposit) => sum + toNumber(deposit.amountCollected), 0)

  function updateFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }))
  }

  function setDayStatus(status) {
    const id = closing?.id || `DC-${filters.date.replaceAll('-', '')}-${Date.now()}`
    const nextClosings = closing
      ? closings.map((item) => (item.id === closing.id ? { ...item, status, openingBalance, closingBalance } : item))
      : [{ id, date: filters.date, managerName: filters.manager, location: filters.location, openingBalance, closingBalance, status }, ...closings]
    saveMockData('dailyClosings', nextClosings)
    setClosings(nextClosings)
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-3">
          <label>
            <span className="text-sm font-medium text-slate-700">Date</span>
            <input className={fieldClass} type="date" value={filters.date} onChange={(event) => updateFilter('date', event.target.value)} />
          </label>
          <label>
            <span className="text-sm font-medium text-slate-700">Manager</span>
            <select className={fieldClass} value={filters.manager} onChange={(event) => updateFilter('manager', event.target.value)}>
              {managers.map((manager) => <option key={manager.id}>{manager.name}</option>)}
            </select>
          </label>
          <label>
            <span className="text-sm font-medium text-slate-700">Location</span>
            <select className={fieldClass} value={filters.location} onChange={(event) => updateFilter('location', event.target.value)}>
              {locations.map((location) => <option key={location.id}>{location.name}</option>)}
            </select>
          </label>
        </div>
      </section>

      <Section title="Manager Ledger Summary">
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <SummaryCard label="Opening Balance" value={openingBalance} />
          <SummaryCard label="Amount Released Today" value={amountReleased} tone="success" />
          <SummaryCard label="Expenses Today" value={expensesToday} tone="warning" />
          <SummaryCard label="Fund Returned" value={fundReturned} />
          <SummaryCard label="Adjustments" value={adjustments} tone={adjustments >= 0 ? 'success' : 'danger'} />
          <SummaryCard label="Carry Forward" value={closingBalance} tone={closingBalance >= 0 ? 'success' : 'danger'} />
        </div>
      </Section>

      <Section title="Transactions Today">
        <TableShell columns={['Date', 'Transaction Type', 'Category', 'Purpose', 'Vehicle', 'Booking ID', 'Driver / Partner / Employee', 'Credit', 'Debit', 'Balance']} minWidth="1300px" empty={transactionsToday.length === 0}>
          {transactionsToday.map((transaction) => {
            const credit = isCredit(transaction.transactionType) ? toNumber(transaction.amount) : 0
            const debit = credit ? 0 : toNumber(transaction.amount)
            const balance = openingBalance + transactionsToday
              .slice(0, transactionsToday.indexOf(transaction) + 1)
              .reduce((sum, item) => sum + (isCredit(item.transactionType) ? toNumber(item.amount) : -toNumber(item.amount)), 0)

            return (
              <tr key={transaction.id}>
                <td className="px-4 py-3 text-slate-600">{transaction.transactionDate}</td>
                <td className="px-4 py-3 font-semibold text-slate-900">{transaction.transactionType}</td>
                <td className="px-4 py-3 text-slate-600">{transaction.category}</td>
                <td className="px-4 py-3 text-slate-600">{transaction.purpose}</td>
                <td className="px-4 py-3 text-slate-600">{transaction.vehicle || '-'}</td>
                <td className="px-4 py-3 text-slate-600">{transaction.bookingId || '-'}</td>
                <td className="px-4 py-3 text-slate-600">{transaction.driver || transaction.partner || transaction.employee || '-'}</td>
                <td className="px-4 py-3 text-emerald-700">₹ {money(credit)}</td>
                <td className="px-4 py-3 text-rose-700">₹ {money(debit)}</td>
                <td className="px-4 py-3 font-semibold text-slate-900">₹ {money(balance)}</td>
              </tr>
            )
          })}
        </TableShell>
      </Section>

      <Section title="Booking Cash Deposit Monitoring">
        <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          Booking cash is monitoring only. It must not be mixed with manager ledger balance.
        </div>
        <TableShell columns={['Booking ID', 'Cash Collected', 'Deposited Amount', 'Deposit Status', 'Reference']} minWidth="800px" empty={bookingCashDepositsToday.length === 0}>
          {bookingCashDepositsToday.map((deposit) => {
            const depositedAmount = ['Deposited', 'Verified'].includes(deposit.depositStatus) ? toNumber(deposit.amountCollected) : 0

            return (
              <tr key={deposit.id}>
                <td className="px-4 py-3 font-semibold text-slate-900">{deposit.bookingId}</td>
                <td className="px-4 py-3 text-slate-600">₹ {money(deposit.amountCollected)}</td>
                <td className="px-4 py-3 text-slate-600">₹ {money(depositedAmount)}</td>
                <td className="px-4 py-3"><StatusBadge status={deposit.depositStatus} /></td>
                <td className="px-4 py-3 text-slate-600">{deposit.depositReferenceNumber || '-'}</td>
              </tr>
            )
          })}
        </TableShell>
      </Section>

      <Section
        title="Closing Actions"
        actions={
          <div className="flex flex-wrap gap-2">
            <button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600" onClick={() => setDayStatus('Closed')}>Close Day</button>
            <button className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setDayStatus('Open')}>Reopen Day</button>
            <button className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Print</button>
            <button className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Export PDF</button>
            <button className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Export Excel</button>
          </div>
        }
      >
        <div className="grid gap-4 md:grid-cols-3">
          <SummaryCard label="Closing Balance / Carry Forward" value={closingBalance} />
          <SummaryCard label="Cash Deposit Pending" value={cashDepositPending} tone={cashDepositPending > 0 ? 'danger' : 'success'} />
          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
            <div className="mt-3"><StatusBadge status={closing?.status || 'Open'} /></div>
          </div>
        </div>
      </Section>
    </div>
  )
}

export default DailyClosingPage
