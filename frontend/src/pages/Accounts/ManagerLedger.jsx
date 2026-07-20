import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getMockData } from '../../services/api'
import { FilterBar, Section, StatusBadge, SummaryCard, TableShell, money, toNumber } from './accountUtils'

function buildManagerSummary(manager, entries) {
  const managerEntries = entries.filter((entry) => entry.manager === manager.name)
  const openingBalance = managerEntries.find((entry) => entry.transactionType === 'Opening Balance')?.runningBalance || 0
  const totalReleased = managerEntries.reduce((sum, entry) => sum + toNumber(entry.credit), 0)
  const totalExpenses = managerEntries.reduce((sum, entry) => sum + toNumber(entry.debit), 0)
  const currentBalance = managerEntries.at(-1)?.runningBalance || openingBalance + totalReleased - totalExpenses

  return {
    manager: manager.name,
    location: manager.location,
    openingBalance,
    totalReleased,
    totalExpenses,
    currentBalance,
    status: currentBalance < 0 ? 'Negative Balance' : currentBalance === 0 ? 'Settled' : 'Open',
  }
}

function ManagerLedgerPage() {
  const managers = useMemo(() => getMockData('managers'), [])
  const entries = useMemo(() => getMockData('managerLedgerEntries'), [])
  const [search, setSearch] = useState('')
  const rows = managers
    .map((manager) => buildManagerSummary(manager, entries))
    .filter((row) => [row.manager, row.location, row.status].join(' ').toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Managers" value={rows.length} prefix="" />
        <SummaryCard label="Total Released" value={rows.reduce((sum, row) => sum + row.totalReleased, 0)} />
        <SummaryCard label="Total Expenses" value={rows.reduce((sum, row) => sum + row.totalExpenses, 0)} tone="warning" />
        <SummaryCard label="Current Balance" value={rows.reduce((sum, row) => sum + row.currentBalance, 0)} tone="success" />
      </div>

      <Section title="Manager Ledger List" actions={<FilterBar search={search} onSearch={setSearch} />}>
        <TableShell columns={['Manager', 'Location', 'Opening Balance', 'Total Released', 'Total Expenses', 'Current Balance', 'Status', 'Actions']} minWidth="1050px" empty={rows.length === 0}>
          {rows.map((row) => (
            <tr key={row.manager} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-semibold text-slate-900">{row.manager}</td>
              <td className="px-4 py-3 text-slate-600">{row.location}</td>
              <td className="px-4 py-3 text-slate-600">₹ {money(row.openingBalance)}</td>
              <td className="px-4 py-3 text-slate-600">₹ {money(row.totalReleased)}</td>
              <td className="px-4 py-3 text-slate-600">₹ {money(row.totalExpenses)}</td>
              <td className="px-4 py-3 font-semibold text-slate-900">₹ {money(row.currentBalance)}</td>
              <td className="px-4 py-3"><StatusBadge status={row.status} /></td>
              <td className="px-4 py-3">
                <Link className="font-semibold text-brand-600 hover:text-brand-700" to={`/accounts/manager-ledger/${encodeURIComponent(row.manager)}`}>
                  View
                </Link>
              </td>
            </tr>
          ))}
        </TableShell>
      </Section>
    </div>
  )
}

export default ManagerLedgerPage
