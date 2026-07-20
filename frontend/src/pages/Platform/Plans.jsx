import { useState } from 'react'
import { getMockData } from '../../services/api'
import { FilterBar, Section, StatusBadge, SummaryCard, TableShell, money } from './platformUtils'

function PlansPage() {
  const [search, setSearch] = useState('')
  const plans = getMockData('subscriptionPlans')
  const rows = plans.filter((plan) =>
    [plan.plan_code, plan.plan_name, plan.description, plan.billing_cycle].join(' ').toLowerCase().includes(search.trim().toLowerCase()),
  )

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Plans" value={plans.length} />
        <SummaryCard label="Active Plans" value={plans.filter((item) => item.is_active).length} tone="success" />
        <SummaryCard label="First Release Limits" value="Users + Vehicles" caption="Keep plan limits simple initially" />
      </div>

      <Section title="Subscription Plan List" subtitle="Plan limits for tenant subscriptions." actions={<FilterBar search={search} onSearch={setSearch} placeholder="Search plans" />}>
        <TableShell columns={['Plan', 'Billing Cycle', 'Base Price', 'Users', 'Vehicles', 'Bookings', 'Storage', 'Trial', 'Status']} minWidth="1050px" empty={rows.length === 0}>
          {rows.map((plan) => (
            <tr key={plan.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <p className="font-semibold text-slate-950">{plan.plan_name}</p>
                <p className="text-xs text-slate-500">{plan.plan_code} • {plan.description}</p>
              </td>
              <td className="px-4 py-3 text-slate-700">{plan.billing_cycle}</td>
              <td className="px-4 py-3 font-semibold text-slate-900">{plan.base_price ? `₹ ${money(plan.base_price)}` : 'Custom'}</td>
              <td className="px-4 py-3 text-slate-700">{plan.user_limit}</td>
              <td className="px-4 py-3 text-slate-700">{plan.vehicle_limit}</td>
              <td className="px-4 py-3 text-slate-700">{plan.booking_limit}</td>
              <td className="px-4 py-3 text-slate-700">{plan.storage_limit_mb}</td>
              <td className="px-4 py-3 text-slate-700">{plan.trial_days} days</td>
              <td className="px-4 py-3"><StatusBadge status={plan.is_active ? 'ACTIVE' : 'INACTIVE'} /></td>
            </tr>
          ))}
        </TableShell>
      </Section>
    </div>
  )
}

export default PlansPage
