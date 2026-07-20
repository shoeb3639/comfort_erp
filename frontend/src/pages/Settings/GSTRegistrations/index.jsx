import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { CheckCircle2, Edit, Eye, GitBranch, Power, Search } from 'lucide-react'
import { getMockData, saveMockData, updateMockRecord } from '../../../services/api'

const fieldClass =
  'mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100'

const labelClass = 'text-sm font-medium text-slate-700'

const registrationTypes = ['Regular', 'Composition', 'Unregistered', 'Other']
const statuses = ['Active', 'Inactive']
const gstinPattern = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/

function formatDate(value) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function StatusBadge({ status }) {
  const className =
    status === 'Active'
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
      : 'bg-slate-100 text-slate-700 ring-slate-500/20'

  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${className}`}>{status}</span>
}

function DefaultBadge({ value }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${
      value ? 'bg-brand-50 text-brand-700 ring-brand-600/20' : 'bg-slate-100 text-slate-600 ring-slate-500/20'
    }`}>
      {value ? 'Default' : 'No'}
    </span>
  )
}

function FieldError({ message }) {
  if (!message) return null
  return <p className="mt-1 text-xs font-semibold text-rose-600">{message}</p>
}

function DetailItem({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-950">{value || '-'}</p>
    </div>
  )
}

function buildInitialValues(registration) {
  return {
    registration_name: registration?.registration_name || '',
    legal_name: registration?.legal_name || '',
    trade_name: registration?.trade_name || '',
    gstin: registration?.gstin || '',
    pan: registration?.pan || '',
    registered_address: registration?.registered_address || '',
    address_line_1: registration?.address_line_1 || '',
    address_line_2: registration?.address_line_2 || '',
    city: registration?.city || '',
    district: registration?.district || '',
    state: registration?.state || '',
    state_code: registration?.state_code || '',
    pincode: registration?.pincode || '',
    country: registration?.country || 'India',
    registration_type: registration?.registration_type || 'Regular',
    effective_from: registration?.effective_from || '',
    effective_to: registration?.effective_to || '',
    status: registration?.status || 'Active',
    is_default: Boolean(registration?.is_default),
    notes: registration?.notes || '',
  }
}

function validate(values) {
  const errors = {}
  if (!values.registration_name.trim()) errors.registration_name = 'Registration name is required.'
  if (!values.legal_name.trim()) errors.legal_name = 'Legal business name is required.'
  if (!values.state.trim()) errors.state = 'State is required.'
  if (!values.state_code.trim()) errors.state_code = 'State code is required.'

  if (values.registration_type === 'Regular' || values.registration_type === 'Composition') {
    if (!values.gstin.trim()) {
      errors.gstin = 'GSTIN is required for this registration type.'
    } else if (!gstinPattern.test(values.gstin.trim().toUpperCase())) {
      errors.gstin = 'Enter a valid GSTIN.'
    }
  } else if (values.gstin.trim() && !gstinPattern.test(values.gstin.trim().toUpperCase())) {
    errors.gstin = 'Enter a valid GSTIN.'
  }

  return errors
}

function BranchAssignmentModal({ registration, branches, onClose, onSave }) {
  const [selectedBranchIds, setSelectedBranchIds] = useState(registration.assigned_branch_ids || [])

  function toggleBranch(branchId) {
    setSelectedBranchIds((currentIds) =>
      currentIds.includes(branchId)
        ? currentIds.filter((id) => id !== branchId)
        : [...currentIds, branchId],
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="border-b border-slate-200 p-5">
          <h3 className="text-lg font-semibold text-slate-950">Assign Branches</h3>
          <p className="text-sm text-slate-500">{registration.registration_name}</p>
        </div>

        <div className="space-y-2 p-5">
          {branches.map((branch) => (
            <label key={branch.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3">
              <span>
                <span className="block text-sm font-semibold text-slate-950">{branch.name}</span>
                <span className="text-xs font-medium text-slate-500">{branch.status}</span>
              </span>
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
                checked={selectedBranchIds.includes(branch.id)}
                onChange={() => toggleBranch(branch.id)}
              />
            </label>
          ))}
        </div>

        <div className="flex justify-end gap-3 border-t border-slate-200 p-5">
          <button type="button" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600" onClick={() => onSave(selectedBranchIds)}>
            Save Branches
          </button>
        </div>
      </div>
    </div>
  )
}

function GSTRegistrationForm({ registration, mode }) {
  const navigate = useNavigate()
  const isEditMode = mode === 'edit'
  const [values, setValues] = useState(() => buildInitialValues(registration))
  const [errors, setErrors] = useState({})

  function updateField(name, value) {
    setValues((currentValues) => ({ ...currentValues, [name]: value }))
  }

  function handleSubmit(event) {
    event.preventDefault()
    const validationErrors = validate(values)
    setErrors(validationErrors)
    if (Object.keys(validationErrors).length) return

    const now = new Date().toISOString()
    const payload = {
      ...(registration || {}),
      ...values,
      tenant_id: registration?.tenant_id || 'TENANT-001',
      id: registration?.id || `GST-${Date.now()}`,
      gstin: values.gstin.trim().toUpperCase(),
      pan: values.pan.trim().toUpperCase(),
      is_default: Boolean(values.is_default),
      assigned_branch_ids: registration?.assigned_branch_ids || [],
      created_at: registration?.created_at || now,
      updated_at: now,
    }

    const records = getMockData('gstRegistrations')
    const nextRecords = records.map((record) =>
      payload.is_default ? { ...record, is_default: false } : record,
    )

    if (isEditMode) {
      saveMockData('gstRegistrations', nextRecords.map((record) => (record.id === payload.id ? payload : record)))
    } else {
      saveMockData('gstRegistrations', [payload, ...nextRecords])
    }

    navigate('/settings/gst-registrations', {
      state: { notice: `${payload.registration_name} ${isEditMode ? 'updated' : 'created'} successfully.` },
    })
  }

  return (
    <form id="gst-registration-form" className="space-y-5" onSubmit={handleSubmit}>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <label>
            <span className={labelClass}>Registration Name</span>
            <input className={fieldClass} value={values.registration_name} onChange={(event) => updateField('registration_name', event.target.value)} />
            <FieldError message={errors.registration_name} />
          </label>
          <label>
            <span className={labelClass}>Legal Business Name</span>
            <input className={fieldClass} value={values.legal_name} onChange={(event) => updateField('legal_name', event.target.value)} />
            <FieldError message={errors.legal_name} />
          </label>
          <label>
            <span className={labelClass}>Trade Name</span>
            <input className={fieldClass} value={values.trade_name} onChange={(event) => updateField('trade_name', event.target.value)} />
          </label>
          <label>
            <span className={labelClass}>Registration Type</span>
            <select className={fieldClass} value={values.registration_type} onChange={(event) => updateField('registration_type', event.target.value)}>
              {registrationTypes.map((type) => <option key={type}>{type}</option>)}
            </select>
          </label>
          <label>
            <span className={labelClass}>GSTIN</span>
            <input className={fieldClass} value={values.gstin} onChange={(event) => updateField('gstin', event.target.value)} />
            <FieldError message={errors.gstin} />
          </label>
          <label>
            <span className={labelClass}>PAN</span>
            <input className={fieldClass} value={values.pan} onChange={(event) => updateField('pan', event.target.value)} />
          </label>
          <label className="md:col-span-2 xl:col-span-3">
            <span className={labelClass}>Registered Address</span>
            <textarea className={`${fieldClass} min-h-20 resize-y`} value={values.registered_address} onChange={(event) => updateField('registered_address', event.target.value)} />
          </label>
          <label>
            <span className={labelClass}>Address Line 1</span>
            <input className={fieldClass} value={values.address_line_1} onChange={(event) => updateField('address_line_1', event.target.value)} />
          </label>
          <label>
            <span className={labelClass}>Address Line 2</span>
            <input className={fieldClass} value={values.address_line_2} onChange={(event) => updateField('address_line_2', event.target.value)} />
          </label>
          <label>
            <span className={labelClass}>City</span>
            <input className={fieldClass} value={values.city} onChange={(event) => updateField('city', event.target.value)} />
          </label>
          <label>
            <span className={labelClass}>District</span>
            <input className={fieldClass} value={values.district} onChange={(event) => updateField('district', event.target.value)} />
          </label>
          <label>
            <span className={labelClass}>State</span>
            <input className={fieldClass} value={values.state} onChange={(event) => updateField('state', event.target.value)} />
            <FieldError message={errors.state} />
          </label>
          <label>
            <span className={labelClass}>State Code</span>
            <input className={fieldClass} value={values.state_code} onChange={(event) => updateField('state_code', event.target.value)} />
            <FieldError message={errors.state_code} />
          </label>
          <label>
            <span className={labelClass}>PIN Code</span>
            <input className={fieldClass} value={values.pincode} onChange={(event) => updateField('pincode', event.target.value)} />
          </label>
          <label>
            <span className={labelClass}>Country</span>
            <input className={fieldClass} value={values.country} onChange={(event) => updateField('country', event.target.value)} />
          </label>
          <label>
            <span className={labelClass}>Effective From</span>
            <input className={fieldClass} type="date" value={values.effective_from} onChange={(event) => updateField('effective_from', event.target.value)} />
          </label>
          <label>
            <span className={labelClass}>Effective To</span>
            <input className={fieldClass} type="date" value={values.effective_to} onChange={(event) => updateField('effective_to', event.target.value)} />
          </label>
          <label>
            <span className={labelClass}>Status</span>
            <select className={fieldClass} value={values.status} onChange={(event) => updateField('status', event.target.value)}>
              {statuses.map((status) => <option key={status}>{status}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3">
            <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={values.is_default} onChange={(event) => updateField('is_default', event.target.checked)} />
            <span className="text-sm font-semibold text-slate-800">Set as default GST registration</span>
          </label>
          <label className="md:col-span-2 xl:col-span-3">
            <span className={labelClass}>Notes</span>
            <textarea className={`${fieldClass} min-h-24 resize-y`} value={values.notes} onChange={(event) => updateField('notes', event.target.value)} />
          </label>
        </div>
      </section>
    </form>
  )
}

function GSTRegistrationDetail({ registration, branches }) {
  const assignedBranches = branches.filter((branch) => (registration.assigned_branch_ids || []).includes(branch.id))

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">GST Registration</p>
            <h3 className="mt-1 text-xl font-semibold text-slate-950">{registration.registration_name}</h3>
            <p className="mt-1 text-sm text-slate-500">{registration.legal_name}</p>
          </div>
          <div className="flex gap-2">
            <DefaultBadge value={registration.is_default} />
            <StatusBadge status={registration.status} />
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <DetailItem label="GSTIN" value={registration.gstin} />
          <DetailItem label="PAN" value={registration.pan} />
          <DetailItem label="Registration Type" value={registration.registration_type} />
          <DetailItem label="State Code" value={registration.state_code} />
          <DetailItem label="Trade Name" value={registration.trade_name} />
          <DetailItem label="State" value={registration.state} />
          <DetailItem label="Effective From" value={formatDate(registration.effective_from)} />
          <DetailItem label="Effective To" value={formatDate(registration.effective_to)} />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h4 className="text-base font-semibold text-slate-950">Registered Address</h4>
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <DetailItem label="Address" value={registration.registered_address} />
          <DetailItem label="Address Line 1" value={registration.address_line_1} />
          <DetailItem label="Address Line 2" value={registration.address_line_2} />
          <DetailItem label="City" value={registration.city} />
          <DetailItem label="District" value={registration.district} />
          <DetailItem label="PIN Code" value={registration.pincode} />
          <DetailItem label="Country" value={registration.country} />
          <DetailItem label="Notes" value={registration.notes} />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h4 className="text-base font-semibold text-slate-950">Assigned Branches</h4>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {assignedBranches.length ? assignedBranches.map((branch) => (
            <div key={branch.id} className="rounded-xl border border-slate-200 px-4 py-3">
              <p className="font-semibold text-slate-950">{branch.name}</p>
              <p className="text-sm text-slate-500">{branch.status}</p>
            </div>
          )) : <p className="text-sm text-slate-500">No branches assigned.</p>}
        </div>
      </section>
    </div>
  )
}

function GSTRegistrationsPage() {
  const params = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [registrations, setRegistrations] = useState(() => getMockData('gstRegistrations'))
  const [assigningRegistration, setAssigningRegistration] = useState(null)
  const branches = useMemo(() => getMockData('locations'), [])
  const invoices = useMemo(() => getMockData('invoices'), [])
  const registrationId = params.registrationId
  const registration = registrations.find((item) => item.id === registrationId)
  const isNewMode = location.pathname.endsWith('/new')
  const isEditMode = location.pathname.endsWith('/edit')

  const filteredRegistrations = registrations.filter((item) => {
    const query = search.trim().toLowerCase()
    const searchableText = [
      item.registration_name,
      item.legal_name,
      item.trade_name,
      item.gstin,
      item.state,
      item.state_code,
      item.status,
    ].join(' ').toLowerCase()
    return !query || searchableText.includes(query)
  })

  function updateRegistrationStatus(item, status) {
    const updatedRegistration = updateMockRecord('gstRegistrations', item.id, {
      status,
      updated_at: new Date().toISOString(),
    })
    setRegistrations((currentRecords) => currentRecords.map((record) => (record.id === item.id ? updatedRegistration : record)))
  }

  function assignBranches(branchIds) {
    const updatedRegistration = updateMockRecord('gstRegistrations', assigningRegistration.id, {
      assigned_branch_ids: branchIds,
      updated_at: new Date().toISOString(),
    })
    setRegistrations((currentRecords) => currentRecords.map((record) => (record.id === assigningRegistration.id ? updatedRegistration : record)))
    setAssigningRegistration(null)
  }

  if (isNewMode) return <GSTRegistrationForm mode="new" />

  if (isEditMode) {
    if (!registration) {
      return (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          GST registration not found. <Link className="font-semibold text-brand-600" to="/settings/gst-registrations">Back to list</Link>
        </div>
      )
    }
    return <GSTRegistrationForm registration={registration} mode="edit" />
  }

  if (registrationId) {
    if (!registration) {
      return (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          GST registration not found. <Link className="font-semibold text-brand-600" to="/settings/gst-registrations">Back to list</Link>
        </div>
      )
    }
    return <GSTRegistrationDetail registration={registration} branches={branches} />
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">GST Registration List</h3>
            <p className="mt-1 text-sm text-slate-500">Manage tenant GST registrations, defaults, and branch assignments.</p>
          </div>
          <label className="flex min-w-[280px] items-center rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
            <Search className="mr-2 text-slate-400" size={18} strokeWidth={2.2} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full bg-transparent text-slate-800 outline-none placeholder:text-slate-400"
              placeholder="Search GSTIN, state, legal name"
            />
          </label>
        </div>

        <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-[1100px] divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Registration Name</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Legal Name</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">GSTIN</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">State</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">State Code</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Assigned Branches</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Default</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {filteredRegistrations.map((item) => {
                const assignedBranchCount = item.assigned_branch_ids?.length || 0
                const invoiceUsesRegistration = invoices.some((invoice) => invoice.gst_registration_id === item.id)

                return (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-950">{item.registration_name}</td>
                    <td className="px-4 py-3 text-slate-700">{item.legal_name}</td>
                    <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">{item.gstin || '-'}</td>
                    <td className="px-4 py-3 text-slate-700">{item.state}</td>
                    <td className="px-4 py-3 text-slate-700">{item.state_code}</td>
                    <td className="px-4 py-3 text-slate-700">{assignedBranchCount}</td>
                    <td className="px-4 py-3"><DefaultBadge value={item.is_default} /></td>
                    <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-end gap-2">
                        <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={() => navigate(`/settings/gst-registrations/${item.id}`)}>
                          <Eye size={14} /> View
                        </button>
                        <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={() => navigate(`/settings/gst-registrations/${item.id}/edit`)}>
                          <Edit size={14} /> Edit
                        </button>
                        <button type="button" className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50" onClick={() => setAssigningRegistration(item)}>
                          <GitBranch size={14} /> Assign Branches
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          title={invoiceUsesRegistration ? 'Used by generated invoices; deletion is disabled by design.' : ''}
                          onClick={() => updateRegistrationStatus(item, item.status === 'Active' ? 'Inactive' : 'Active')}
                        >
                          <Power size={14} /> {item.status === 'Active' ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filteredRegistrations.length === 0 && <div className="bg-white px-4 py-10 text-center text-sm text-slate-500">No GST registrations found.</div>}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 text-emerald-600" size={18} />
          <div className="text-sm text-slate-600">
            <p className="font-semibold text-slate-900">Rules prepared for backend integration</p>
            <p className="mt-1">Only one default GST registration is allowed. Inactive GST registrations should not be selectable for future invoice series. Registrations used by generated invoices are intended to be non-deletable.</p>
          </div>
        </div>
      </section>

      {assigningRegistration && (
        <BranchAssignmentModal
          registration={assigningRegistration}
          branches={branches}
          onClose={() => setAssigningRegistration(null)}
          onSave={assignBranches}
        />
      )}
    </div>
  )
}

export default GSTRegistrationsPage
