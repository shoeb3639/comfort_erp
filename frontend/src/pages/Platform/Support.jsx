import { useState } from 'react'
import { getMockData } from '../../services/api'
import { FilterBar, Section, StatusBadge, SummaryCard, TableShell, formatDate } from './platformUtils'

function getTenantName(tenants, tenantId) {
  const tenant = tenants.find((item) => item.id === tenantId)
  return tenant?.trade_name || tenant?.legal_name || tenantId
}

function SupportPage() {
  const tenants = getMockData('platformTenants')
  const tickets = getMockData('platformSupportTickets')
  const [search, setSearch] = useState('')
  const rows = tickets.filter((ticket) =>
    [ticket.id, getTenantName(tenants, ticket.tenant_id), ticket.subject, ticket.priority, ticket.status].join(' ').toLowerCase().includes(search.trim().toLowerCase()),
  )

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Tickets" value={tickets.length} />
        <SummaryCard label="Open" value={tickets.filter((item) => item.status === 'OPEN').length} tone="warning" />
        <SummaryCard label="Pending" value={tickets.filter((item) => item.status === 'PENDING').length} tone="danger" />
        <SummaryCard label="High Priority" value={tickets.filter((item) => item.priority === 'High').length} tone="danger" />
      </div>

      <Section title="Support Controls" subtitle="Platform-owner view of tenant support requests." actions={<FilterBar search={search} onSearch={setSearch} placeholder="Search tickets" />}>
        <TableShell columns={['Ticket', 'Tenant', 'Subject', 'Priority', 'Status', 'Created', 'Assigned To']} minWidth="950px" empty={rows.length === 0}>
          {rows.map((ticket) => (
            <tr key={ticket.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-semibold text-slate-950">{ticket.id}</td>
              <td className="px-4 py-3 text-slate-700">{getTenantName(tenants, ticket.tenant_id)}</td>
              <td className="px-4 py-3 text-slate-700">{ticket.subject}</td>
              <td className="px-4 py-3 text-slate-700">{ticket.priority}</td>
              <td className="px-4 py-3"><StatusBadge status={ticket.status} /></td>
              <td className="px-4 py-3 text-slate-700">{formatDate(ticket.created_at)}</td>
              <td className="px-4 py-3 text-slate-700">{ticket.assigned_to}</td>
            </tr>
          ))}
        </TableShell>
      </Section>
    </div>
  )
}

export default SupportPage
