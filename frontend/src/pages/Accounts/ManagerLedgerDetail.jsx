import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getMockData } from '../../services/api'
import { Section, StatusBadge, SummaryCard, TableShell, money, toNumber } from './accountUtils'

function ManagerLedgerDetailPage() {
  const { managerName } = useParams()
  const manager = decodeURIComponent(managerName || '')
  const entries = useMemo(() => getMockData('managerLedgerEntries'), [])
  const rows = entries.filter((entry) => entry.manager === manager)
  const credits = rows.reduce((sum, row) => sum + toNumber(row.credit), 0)
  const debits = rows.reduce((sum, row) => sum + toNumber(row.debit), 0)
  const balance = rows.at(-1)?.runningBalance || credits - debits

  if (!manager) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
        Manager not found. <Link className="font-semibold text-brand-600" to="/accounts/manager-ledger">Back to ledger</Link>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Manager" value={manager} prefix="" />
        <SummaryCard label="Total Credit" value={credits} />
        <SummaryCard label="Total Debit" value={debits} tone="warning" />
        <SummaryCard label="Current Balance" value={balance} tone={balance >= 0 ? 'success' : 'danger'} />
      </div>

      <Section title="Running Manager Ledger">
        <TableShell columns={['Date', 'Transaction Type', 'Description', 'Credit', 'Debit', 'Running Balance', 'Reference', 'Actions']} minWidth="1050px" empty={rows.length === 0}>
          {rows.map((row) => (
            <tr key={row.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 text-slate-600">{row.date}</td>
              <td className="px-4 py-3 font-semibold text-slate-900">{row.transactionType}</td>
              <td className="px-4 py-3 text-slate-600">{row.description}</td>
              <td className="px-4 py-3 text-emerald-700">₹ {money(row.credit)}</td>
              <td className="px-4 py-3 text-rose-700">₹ {money(row.debit)}</td>
              <td className="px-4 py-3 font-semibold text-slate-900">₹ {money(row.runningBalance)}</td>
              <td className="px-4 py-3 text-slate-600">{row.reference || '-'}</td>
              <td className="px-4 py-3"><StatusBadge status="View" /></td>
            </tr>
          ))}
        </TableShell>
      </Section>
    </div>
  )
}

export default ManagerLedgerDetailPage
