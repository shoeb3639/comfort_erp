import { useState } from 'react'
import { getMockData, updateMockRecord } from '../../services/api'
import { FilterBar, Section, StatusBadge, SummaryCard, TableShell, formatDate, money } from './platformUtils'

const statusOptions = ['TRIAL', 'ACTIVE', 'GRACE_PERIOD', 'EXPIRED', 'SUSPENDED', 'CANCELLED']

function getTenantName(tenants, tenantId) {
  const tenant = tenants.find((item) => item.id === tenantId)
  return tenant?.trade_name || tenant?.legal_name || tenantId
}

function getPlanName(plans, planId) {
  return plans.find((item) => item.id === planId)?.plan_name || planId
}

function SubscriptionsPage() {
  const tenants = getMockData('platformTenants')
  const plans = getMockData('subscriptionPlans')
  const [subscriptions, setSubscriptions] = useState(() => getMockData('tenantSubscriptions'))
  const [search, setSearch] = useState('')

  const rows = subscriptions.filter((item) =>
    [getTenantName(tenants, item.tenant_id), getPlanName(plans, item.plan_id), item.subscription_status, item.payment_status].join(' ').toLowerCase().includes(search.trim().toLowerCase()),
  )

  function updateStatus(item, status) {
    const updated = updateMockRecord('tenantSubscriptions', item.id, {
      subscription_status: status,
      updated_at: new Date().toISOString(),
    })
    setSubscriptions((current) => current.map((record) => (record.id === item.id ? updated : record)))
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Subscriptions" value={subscriptions.length} />
        <SummaryCard label="Active" value={subscriptions.filter((item) => item.subscription_status === 'ACTIVE').length} tone="success" />
        <SummaryCard label="Trial" value={subscriptions.filter((item) => item.subscription_status === 'TRIAL').length} tone="warning" />
        <SummaryCard label="Blocked" value={subscriptions.filter((item) => ['EXPIRED', 'SUSPENDED', 'CANCELLED'].includes(item.subscription_status)).length} tone="danger" />
      </div>

      <Section title="Tenant Subscription List" subtitle="Subscription status controls tenant ERP access." actions={<FilterBar search={search} onSearch={setSearch} placeholder="Search subscriptions" />}>
        <TableShell columns={['Tenant', 'Plan', 'Period', 'Amount', 'Payment', 'Subscription', 'Grace End', 'Auto Renew', 'Actions']} minWidth="1200px" empty={rows.length === 0}>
          {rows.map((item) => (
            <tr key={item.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-semibold text-slate-950">{getTenantName(tenants, item.tenant_id)}</td>
              <td className="px-4 py-3 text-slate-700">{getPlanName(plans, item.plan_id)}</td>
              <td className="px-4 py-3 text-slate-700">{formatDate(item.start_date)} to {formatDate(item.end_date)}</td>
              <td className="px-4 py-3 font-semibold text-slate-900">₹ {money(item.final_amount)}</td>
              <td className="px-4 py-3"><StatusBadge status={item.payment_status} /></td>
              <td className="px-4 py-3"><StatusBadge status={item.subscription_status} /></td>
              <td className="px-4 py-3 text-slate-700">{formatDate(item.grace_period_end_date)}</td>
              <td className="px-4 py-3 text-slate-700">{item.auto_renew ? 'Yes' : 'No'}</td>
              <td className="px-4 py-3">
                <select className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-700" value={item.subscription_status} onChange={(event) => updateStatus(item, event.target.value)}>
                  {statusOptions.map((status) => <option key={status}>{status}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </TableShell>
      </Section>
    </div>
  )
}

export default SubscriptionsPage
