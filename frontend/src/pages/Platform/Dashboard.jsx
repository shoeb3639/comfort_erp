import { Link } from 'react-router-dom'
import { getMockData } from '../../services/api'
import { Section, StatusBadge, SummaryCard, TableShell, formatDate, money, toNumber } from './platformUtils'

function getTenantName(tenants, tenantId) {
  const tenant = tenants.find((item) => item.id === tenantId)
  return tenant?.trade_name || tenant?.legal_name || tenantId
}

function PlatformDashboardPage() {
  const tenants = getMockData('platformTenants')
  const subscriptions = getMockData('tenantSubscriptions')
  const payments = getMockData('subscriptionPayments')
  const supportTickets = getMockData('platformSupportTickets')
  const auditLogs = getMockData('platformAuditLogs')

  const activeSubscriptions = subscriptions.filter((item) => item.subscription_status === 'ACTIVE')
  const trialSubscriptions = subscriptions.filter((item) => item.subscription_status === 'TRIAL')
  const suspendedTenants = tenants.filter((item) => item.status === 'SUSPENDED')
  const expiredSubscriptions = subscriptions.filter((item) => ['EXPIRED', 'SUSPENDED'].includes(item.subscription_status))
  const expiringSoon = subscriptions.filter((item) => {
    const end = new Date(item.end_date)
    if (Number.isNaN(end.getTime())) return false
    const today = new Date('2026-07-18T00:00:00.000Z')
    const days = Math.ceil((end - today) / 86400000)
    return days >= 0 && days <= 7
  })
  const monthlyRecurringRevenue = activeSubscriptions.reduce((sum, item) => sum + toNumber(item.final_amount), 0)
  const outstandingPayments = payments
    .filter((item) => item.payment_status !== 'PAID')
    .reduce((sum, item) => sum + toNumber(item.amount), 0)

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Total Tenants" value={tenants.length} caption="All onboarded companies" />
        <SummaryCard label="Active Subscriptions" value={activeSubscriptions.length} tone="success" />
        <SummaryCard label="Trial Tenants" value={trialSubscriptions.length} tone="warning" />
        <SummaryCard label="Suspended Tenants" value={suspendedTenants.length} tone="danger" />
        <SummaryCard label="Expiring Soon" value={expiringSoon.length} tone="warning" caption="Next 7 days" />
        <SummaryCard label="Expired / Blocked" value={expiredSubscriptions.length} tone="danger" />
        <SummaryCard label="MRR" value={money(monthlyRecurringRevenue)} prefix="₹ " tone="success" />
        <SummaryCard label="Outstanding" value={money(outstandingPayments)} prefix="₹ " tone="danger" />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Section
          title="Subscriptions Needing Attention"
          subtitle="Trials, grace-period accounts, overdue payments, and suspended tenants."
          actions={<Link className="text-sm font-semibold text-brand-600" to="/platform/subscriptions">View all</Link>}
        >
          <TableShell columns={['Tenant', 'Status', 'Payment', 'End Date', 'Amount']} minWidth="720px" empty={subscriptions.length === 0}>
            {subscriptions.slice(0, 6).map((item) => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-semibold text-slate-900">{getTenantName(tenants, item.tenant_id)}</td>
                <td className="px-4 py-3"><StatusBadge status={item.subscription_status} /></td>
                <td className="px-4 py-3"><StatusBadge status={item.payment_status} /></td>
                <td className="px-4 py-3 text-slate-600">{formatDate(item.end_date)}</td>
                <td className="px-4 py-3 font-semibold text-slate-900">₹ {money(item.final_amount)}</td>
              </tr>
            ))}
          </TableShell>
        </Section>

        <Section
          title="Recent Platform Activity"
          subtitle="Tenant, subscription, payment, and support audit events."
          actions={<Link className="text-sm font-semibold text-brand-600" to="/platform/audit-logs">Audit logs</Link>}
        >
          <div className="space-y-3">
            {auditLogs.slice(0, 5).map((item) => (
              <div key={item.id} className="rounded-xl border border-slate-200 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-950">{item.action}</p>
                    <p className="mt-1 text-sm text-slate-500">{item.module} • {item.reference}</p>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">{formatDate(item.date)}</span>
                </div>
                <p className="mt-2 text-sm text-slate-600">{item.remarks}</p>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <Section title="Open Support Controls" subtitle="Tenant issues that may need platform-owner action.">
        <TableShell columns={['Ticket', 'Tenant', 'Subject', 'Priority', 'Status', 'Assigned To']} minWidth="900px" empty={supportTickets.length === 0}>
          {supportTickets.map((item) => (
            <tr key={item.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-semibold text-slate-900">{item.id}</td>
              <td className="px-4 py-3 text-slate-700">{getTenantName(tenants, item.tenant_id)}</td>
              <td className="px-4 py-3 text-slate-700">{item.subject}</td>
              <td className="px-4 py-3 text-slate-700">{item.priority}</td>
              <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
              <td className="px-4 py-3 text-slate-700">{item.assigned_to}</td>
            </tr>
          ))}
        </TableShell>
      </Section>
    </div>
  )
}

export default PlatformDashboardPage
