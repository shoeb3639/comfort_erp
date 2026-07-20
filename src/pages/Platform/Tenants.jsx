import { useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { createMockRecord, getMockData, updateMockRecord } from '../../services/api'
import { FilterBar, Section, StatusBadge, SummaryCard, TableShell, fieldClass, formatDate } from './platformUtils'

const emptyTenant = {
  legal_name: '',
  trade_name: '',
  tenant_code: '',
  business_type: 'Car Rental',
  email: '',
  mobile: '',
  alternate_number: '',
  website: '',
  logo_url: '',
  gstin: '',
  pan: '',
  company_registration_number: '',
  state_code: '',
  tax_registration_type: 'Regular',
  billing_address: '',
  address_line_1: '',
  address_line_2: '',
  city: '',
  state: '',
  postal_code: '',
  country: 'India',
  owner_name: '',
  owner_email: '',
  owner_mobile: '',
  owner_designation: 'Owner',
  timezone: 'Asia/Kolkata',
  currency: 'INR',
  financial_year_start_month: 'April',
  date_format: 'DD-MM-YYYY',
  invoice_prefix: '',
  invoice_number_length: 4,
  status: 'PENDING_SETUP',
  onboarding_status: 'OWNER_INVITED',
}

function TenantModal({ onClose, onSave }) {
  const [values, setValues] = useState(emptyTenant)

  function updateField(name, value) {
    setValues((current) => ({ ...current, [name]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    const now = new Date().toISOString()
    onSave({
      ...values,
      id: `TENANT-${Date.now()}`,
      tenant_code: values.tenant_code.trim().toUpperCase(),
      created_at: now,
      updated_at: now,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
          <div>
            <h3 className="text-lg font-semibold text-slate-950">Create Tenant</h3>
            <p className="mt-1 text-sm text-slate-500">Create company, owner, and initial setup record. Subscription can be assigned from subscriptions.</p>
          </div>
          <button type="button" aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form className="space-y-6 p-5" onSubmit={handleSubmit}>
          <section>
            <h4 className="text-sm font-semibold text-slate-950">Basic Company Information</h4>
            <div className="mt-3 grid gap-4 md:grid-cols-3">
              <label><span className="text-sm font-medium text-slate-700">Company Legal Name</span><input required className={fieldClass} value={values.legal_name} onChange={(event) => updateField('legal_name', event.target.value)} /></label>
              <label><span className="text-sm font-medium text-slate-700">Trade Name</span><input required className={fieldClass} value={values.trade_name} onChange={(event) => updateField('trade_name', event.target.value)} /></label>
              <label><span className="text-sm font-medium text-slate-700">Tenant Code</span><input required className={fieldClass} value={values.tenant_code} onChange={(event) => updateField('tenant_code', event.target.value)} /></label>
              <label><span className="text-sm font-medium text-slate-700">Business Type</span><input className={fieldClass} value={values.business_type} onChange={(event) => updateField('business_type', event.target.value)} /></label>
              <label><span className="text-sm font-medium text-slate-700">Email</span><input required type="email" className={fieldClass} value={values.email} onChange={(event) => updateField('email', event.target.value)} /></label>
              <label><span className="text-sm font-medium text-slate-700">Mobile Number</span><input required className={fieldClass} value={values.mobile} onChange={(event) => updateField('mobile', event.target.value)} /></label>
              <label><span className="text-sm font-medium text-slate-700">Alternate Number</span><input className={fieldClass} value={values.alternate_number} onChange={(event) => updateField('alternate_number', event.target.value)} /></label>
              <label><span className="text-sm font-medium text-slate-700">Website</span><input className={fieldClass} value={values.website} onChange={(event) => updateField('website', event.target.value)} /></label>
              <label><span className="text-sm font-medium text-slate-700">Logo URL</span><input className={fieldClass} value={values.logo_url} onChange={(event) => updateField('logo_url', event.target.value)} /></label>
              <label><span className="text-sm font-medium text-slate-700">Address Line 1</span><input required className={fieldClass} value={values.address_line_1} onChange={(event) => updateField('address_line_1', event.target.value)} /></label>
              <label><span className="text-sm font-medium text-slate-700">Address Line 2</span><input className={fieldClass} value={values.address_line_2} onChange={(event) => updateField('address_line_2', event.target.value)} /></label>
              <label><span className="text-sm font-medium text-slate-700">City</span><input required className={fieldClass} value={values.city} onChange={(event) => updateField('city', event.target.value)} /></label>
              <label><span className="text-sm font-medium text-slate-700">State</span><input required className={fieldClass} value={values.state} onChange={(event) => updateField('state', event.target.value)} /></label>
              <label><span className="text-sm font-medium text-slate-700">PIN Code</span><input required className={fieldClass} value={values.postal_code} onChange={(event) => updateField('postal_code', event.target.value)} /></label>
              <label><span className="text-sm font-medium text-slate-700">Country</span><input className={fieldClass} value={values.country} onChange={(event) => updateField('country', event.target.value)} /></label>
            </div>
          </section>

          <section>
            <h4 className="text-sm font-semibold text-slate-950">Legal, Tax, Owner, and Operational Settings</h4>
            <div className="mt-3 grid gap-4 md:grid-cols-3">
              <label><span className="text-sm font-medium text-slate-700">GSTIN Optional</span><input className={fieldClass} value={values.gstin} onChange={(event) => updateField('gstin', event.target.value)} /></label>
              <label><span className="text-sm font-medium text-slate-700">PAN</span><input className={fieldClass} value={values.pan} onChange={(event) => updateField('pan', event.target.value)} /></label>
              <label><span className="text-sm font-medium text-slate-700">State Code</span><input className={fieldClass} value={values.state_code} onChange={(event) => updateField('state_code', event.target.value)} /></label>
              <label><span className="text-sm font-medium text-slate-700">Tax Registration Type</span><select className={fieldClass} value={values.tax_registration_type} onChange={(event) => updateField('tax_registration_type', event.target.value)}><option>Regular</option><option>Composition</option><option>Unregistered</option><option>Other</option></select></label>
              <label><span className="text-sm font-medium text-slate-700">Owner Name</span><input required className={fieldClass} value={values.owner_name} onChange={(event) => updateField('owner_name', event.target.value)} /></label>
              <label><span className="text-sm font-medium text-slate-700">Owner Email / Login</span><input required type="email" className={fieldClass} value={values.owner_email} onChange={(event) => updateField('owner_email', event.target.value)} /></label>
              <label><span className="text-sm font-medium text-slate-700">Owner Mobile</span><input required className={fieldClass} value={values.owner_mobile} onChange={(event) => updateField('owner_mobile', event.target.value)} /></label>
              <label><span className="text-sm font-medium text-slate-700">Designation</span><input className={fieldClass} value={values.owner_designation} onChange={(event) => updateField('owner_designation', event.target.value)} /></label>
              <label><span className="text-sm font-medium text-slate-700">Default Currency</span><input className={fieldClass} value={values.currency} onChange={(event) => updateField('currency', event.target.value)} /></label>
              <label><span className="text-sm font-medium text-slate-700">Time Zone</span><input className={fieldClass} value={values.timezone} onChange={(event) => updateField('timezone', event.target.value)} /></label>
              <label><span className="text-sm font-medium text-slate-700">Financial Year</span><input className={fieldClass} value={values.financial_year_start_month} onChange={(event) => updateField('financial_year_start_month', event.target.value)} /></label>
              <label><span className="text-sm font-medium text-slate-700">Date Format</span><input className={fieldClass} value={values.date_format} onChange={(event) => updateField('date_format', event.target.value)} /></label>
              <label><span className="text-sm font-medium text-slate-700">Invoice Prefix</span><input className={fieldClass} value={values.invoice_prefix} onChange={(event) => updateField('invoice_prefix', event.target.value)} /></label>
              <label><span className="text-sm font-medium text-slate-700">Invoice Number Length</span><input type="number" className={fieldClass} value={values.invoice_number_length} onChange={(event) => updateField('invoice_number_length', event.target.value)} /></label>
            </div>
          </section>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
            <button type="button" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={onClose}>Cancel</button>
            <button className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">Create Tenant</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function TenantsPage() {
  const [search, setSearch] = useState('')
  const [tenants, setTenants] = useState(() => getMockData('platformTenants'))
  const [showCreate, setShowCreate] = useState(false)
  const subscriptions = useMemo(() => getMockData('tenantSubscriptions'), [])

  const rows = tenants.filter((tenant) =>
    [tenant.tenant_code, tenant.legal_name, tenant.trade_name, tenant.city, tenant.status, tenant.owner_name].join(' ').toLowerCase().includes(search.trim().toLowerCase()),
  )

  function createTenant(record) {
    createMockRecord('platformTenants', record)
    setTenants((current) => [record, ...current])
    setShowCreate(false)
  }

  function updateTenantStatus(tenant, status) {
    const updated = updateMockRecord('platformTenants', tenant.id, { status, updated_at: new Date().toISOString() })
    setTenants((current) => current.map((item) => (item.id === tenant.id ? updated : item)))
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Tenants" value={tenants.length} />
        <SummaryCard label="Active" value={tenants.filter((item) => item.status === 'ACTIVE').length} tone="success" />
        <SummaryCard label="Pending Setup" value={tenants.filter((item) => item.status === 'PENDING_SETUP').length} tone="warning" />
        <SummaryCard label="Suspended" value={tenants.filter((item) => item.status === 'SUSPENDED').length} tone="danger" />
      </div>

      <Section
        title="Tenant List"
        subtitle="Cablix platform-owner records. These are not tenant ERP customers."
        actions={
          <div className="flex flex-col gap-3 sm:flex-row">
            <FilterBar search={search} onSearch={setSearch} placeholder="Search tenant" />
            <button type="button" className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600" onClick={() => setShowCreate(true)}>
              <Plus size={16} /> Add Tenant
            </button>
          </div>
        }
      >
        <TableShell columns={['Tenant', 'Owner', 'Location', 'Subscription', 'Onboarding', 'Status', 'Created', 'Actions']} minWidth="1100px" empty={rows.length === 0}>
          {rows.map((tenant) => {
            const subscription = subscriptions.find((item) => item.tenant_id === tenant.id)
            return (
              <tr key={tenant.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-950">{tenant.trade_name}</p>
                  <p className="text-xs font-medium text-slate-500">{tenant.tenant_code} • {tenant.legal_name}</p>
                </td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-slate-800">{tenant.owner_name}</p>
                  <p className="text-xs text-slate-500">{tenant.owner_email}</p>
                </td>
                <td className="px-4 py-3 text-slate-700">{tenant.city}, {tenant.state}</td>
                <td className="px-4 py-3"><StatusBadge status={subscription?.subscription_status || 'NO_SUBSCRIPTION'} /></td>
                <td className="px-4 py-3"><StatusBadge status={tenant.onboarding_status} /></td>
                <td className="px-4 py-3"><StatusBadge status={tenant.status} /></td>
                <td className="px-4 py-3 text-slate-600">{formatDate(tenant.created_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-2">
                    {tenant.status !== 'ACTIVE' && <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={() => updateTenantStatus(tenant, 'ACTIVE')}>Activate</button>}
                    {tenant.status !== 'SUSPENDED' && <button className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={() => updateTenantStatus(tenant, 'SUSPENDED')}>Suspend</button>}
                  </div>
                </td>
              </tr>
            )
          })}
        </TableShell>
      </Section>

      {showCreate && <TenantModal onClose={() => setShowCreate(false)} onSave={createTenant} />}
    </div>
  )
}

export default TenantsPage
