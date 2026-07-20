import { useState } from 'react'
import { getMockData } from '../../services/api'
import { FilterBar, Section, StatusBadge, SummaryCard, TableShell, formatDate, money, toNumber } from './platformUtils'

function getTenantName(tenants, tenantId) {
  const tenant = tenants.find((item) => item.id === tenantId)
  return tenant?.trade_name || tenant?.legal_name || tenantId
}

function PaymentsPage() {
  const tenants = getMockData('platformTenants')
  const payments = getMockData('subscriptionPayments')
  const [search, setSearch] = useState('')
  const rows = payments.filter((item) =>
    [item.id, getTenantName(tenants, item.tenant_id), item.reference_number, item.payment_status, item.invoice_number].join(' ').toLowerCase().includes(search.trim().toLowerCase()),
  )
  const paidAmount = payments.filter((item) => item.payment_status === 'PAID').reduce((sum, item) => sum + toNumber(item.amount), 0)
  const outstandingAmount = payments.filter((item) => item.payment_status !== 'PAID').reduce((sum, item) => sum + toNumber(item.amount), 0)

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Payment Records" value={payments.length} />
        <SummaryCard label="Paid Amount" value={money(paidAmount)} prefix="₹ " tone="success" />
        <SummaryCard label="Outstanding Amount" value={money(outstandingAmount)} prefix="₹ " tone="danger" />
      </div>

      <Section title="Subscription Payments" subtitle="SaaS billing records owned by Cablix." actions={<FilterBar search={search} onSearch={setSearch} placeholder="Search payments" />}>
        <TableShell columns={['Payment ID', 'Tenant', 'Date', 'Amount', 'Mode', 'Reference', 'Invoice', 'Status', 'Remarks']} minWidth="1050px" empty={rows.length === 0}>
          {rows.map((payment) => (
            <tr key={payment.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-semibold text-slate-950">{payment.id}</td>
              <td className="px-4 py-3 text-slate-700">{getTenantName(tenants, payment.tenant_id)}</td>
              <td className="px-4 py-3 text-slate-700">{formatDate(payment.payment_date)}</td>
              <td className="px-4 py-3 font-semibold text-slate-900">₹ {money(payment.amount)}</td>
              <td className="px-4 py-3 text-slate-700">{payment.payment_mode}</td>
              <td className="px-4 py-3 text-slate-700">{payment.reference_number || '-'}</td>
              <td className="px-4 py-3 text-slate-700">{payment.invoice_number}</td>
              <td className="px-4 py-3"><StatusBadge status={payment.payment_status} /></td>
              <td className="px-4 py-3 text-slate-700">{payment.remarks}</td>
            </tr>
          ))}
        </TableShell>
      </Section>
    </div>
  )
}

export default PaymentsPage
