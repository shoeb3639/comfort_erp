import { useState } from 'react'
import { getMockData } from '../../services/api'
import { FilterBar, Section, SummaryCard, TableShell, formatDate } from './platformUtils'

function AuditLogsPage() {
  const logs = getMockData('platformAuditLogs')
  const [search, setSearch] = useState('')
  const rows = logs.filter((log) =>
    [log.user, log.action, log.module, log.reference, log.remarks].join(' ').toLowerCase().includes(search.trim().toLowerCase()),
  )

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Audit Events" value={logs.length} />
        <SummaryCard label="Tenant Events" value={logs.filter((item) => item.module === 'Tenants').length} />
        <SummaryCard label="Subscription Events" value={logs.filter((item) => item.module === 'Subscriptions').length} />
      </div>

      <Section title="Platform Audit Logs" subtitle="Platform-level tenant and subscription actions." actions={<FilterBar search={search} onSearch={setSearch} placeholder="Search audit logs" />}>
        <TableShell columns={['Date', 'User', 'Action', 'Module', 'Reference', 'Remarks']} minWidth="950px" empty={rows.length === 0}>
          {rows.map((log) => (
            <tr key={log.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 text-slate-700">{formatDate(log.date)}</td>
              <td className="px-4 py-3 font-semibold text-slate-950">{log.user}</td>
              <td className="px-4 py-3 text-slate-700">{log.action}</td>
              <td className="px-4 py-3 text-slate-700">{log.module}</td>
              <td className="px-4 py-3 text-slate-700">{log.reference}</td>
              <td className="px-4 py-3 text-slate-700">{log.remarks}</td>
            </tr>
          ))}
        </TableShell>
      </Section>
    </div>
  )
}

export default AuditLogsPage
