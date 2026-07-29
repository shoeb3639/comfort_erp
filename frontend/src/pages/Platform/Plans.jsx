import { useEffect, useMemo, useState } from 'react'
import { Pencil, Plus, X } from 'lucide-react'
import {
  createSubscriptionPlan,
  deactivateSubscriptionPlan,
  getAllSubscriptionPlans,
  getPlatformErrorMessage,
  updateSubscriptionPlan,
} from '../../services/platform'
import {
  FilterBar,
  Section,
  StatusBadge,
  SummaryCard,
  TableShell,
  fieldClass,
  money,
} from './platformUtils'

const emptyPlan = {
  code: '',
  name: '',
  description: '',
  billingCycle: 'MONTHLY',
  basePrice: 0,
  validityDays: 30,
  userLimit: '',
  vehicleLimit: '',
  bookingLimit: '',
  storageLimitMb: '',
  trialDays: 0,
  isActive: true,
}

function optionalNumber(value) {
  return value === '' ? null : Number(value)
}

function PlanModal({ plan, onClose, onSave }) {
  const [values, setValues] = useState(() =>
    plan
      ? {
          ...emptyPlan,
          ...plan,
          basePrice: Number(plan.basePrice),
          validityDays: plan.validityDays ?? '',
          userLimit: plan.userLimit ?? '',
          vehicleLimit: plan.vehicleLimit ?? '',
          bookingLimit: plan.bookingLimit ?? '',
          storageLimitMb: plan.storageLimitMb ?? '',
        }
      : emptyPlan,
  )
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  function update(name, value) {
    setValues((current) => ({ ...current, [name]: value }))
  }

  async function submit(event) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)
    try {
      await onSave({
        code: values.code,
        name: values.name,
        description: values.description,
        billingCycle: values.billingCycle,
        basePrice: Number(values.basePrice),
        validityDays: optionalNumber(values.validityDays),
        userLimit: optionalNumber(values.userLimit),
        vehicleLimit: optionalNumber(values.vehicleLimit),
        bookingLimit: optionalNumber(values.bookingLimit),
        storageLimitMb: optionalNumber(values.storageLimitMb),
        trialDays: Number(values.trialDays),
        isActive: values.isActive,
      })
    } catch (requestError) {
      setError(getPlatformErrorMessage(requestError))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 p-5">
          <div>
            <h3 className="text-lg font-semibold text-slate-950">
              {plan ? 'Edit Subscription Plan' : 'Create Subscription Plan'}
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Configure billing, trial period, and tenant usage limits.
            </p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        <form className="space-y-5 p-5" onSubmit={submit}>
          <div className="grid gap-4 md:grid-cols-2">
            <PlanField label="Plan Code" required disabled={Boolean(plan)} value={values.code} onChange={(value) => update('code', value.toUpperCase())} />
            <PlanField label="Plan Name" required value={values.name} onChange={(value) => update('name', value)} />
            <label className="md:col-span-2">
              <span className="text-sm font-medium text-slate-700">Description</span>
              <textarea className={fieldClass} rows={3} value={values.description || ''} onChange={(event) => update('description', event.target.value)} />
            </label>
            <label>
              <span className="text-sm font-medium text-slate-700">Billing Cycle</span>
              <select className={fieldClass} value={values.billingCycle} onChange={(event) => update('billingCycle', event.target.value)}>
                {['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'ANNUAL', 'CUSTOM'].map((cycle) => <option key={cycle}>{cycle}</option>)}
              </select>
            </label>
            <PlanField label="Base Price" type="number" min="0" step="0.01" required value={values.basePrice} onChange={(value) => update('basePrice', value)} />
            <PlanField label="Validity Days" type="number" min="1" value={values.validityDays} onChange={(value) => update('validityDays', value)} />
            <PlanField label="Trial Days" type="number" min="0" value={values.trialDays} onChange={(value) => update('trialDays', value)} />
            <PlanField label="User Limit" type="number" min="1" value={values.userLimit} onChange={(value) => update('userLimit', value)} />
            <PlanField label="Vehicle Limit" type="number" min="1" value={values.vehicleLimit} onChange={(value) => update('vehicleLimit', value)} />
            <PlanField label="Booking Limit" type="number" min="1" value={values.bookingLimit} onChange={(value) => update('bookingLimit', value)} />
            <PlanField label="Storage Limit (MB)" type="number" min="1" value={values.storageLimitMb} onChange={(value) => update('storageLimitMb', value)} />
            <label className="flex items-center gap-3 pt-6">
              <input type="checkbox" checked={values.isActive} onChange={(event) => update('isActive', event.target.checked)} />
              <span className="text-sm font-medium text-slate-700">Active plan</span>
            </label>
          </div>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-3 border-t border-slate-200 pt-5">
            <button type="button" className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold" onClick={onClose}>Cancel</button>
            <button disabled={isSubmitting} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {isSubmitting ? 'Saving…' : 'Save Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function PlanField({ label, onChange, ...props }) {
  return <label><span className="text-sm font-medium text-slate-700">{label}</span><input className={fieldClass} onChange={(event) => onChange(event.target.value)} {...props} /></label>
}

function PlansPage() {
  const [plans, setPlans] = useState([])
  const [search, setSearch] = useState('')
  const [editingPlan, setEditingPlan] = useState(null)
  const [showCreate, setShowCreate] = useState(false)
  const [error, setError] = useState('')

  async function loadPlans() {
    setPlans(await getAllSubscriptionPlans())
  }

  useEffect(() => {
    loadPlans().catch((requestError) => setError(getPlatformErrorMessage(requestError)))
  }, [])

  const rows = useMemo(
    () => plans.filter((plan) =>
      [plan.code, plan.name, plan.description, plan.billingCycle]
        .join(' ')
        .toLowerCase()
        .includes(search.trim().toLowerCase())),
    [plans, search],
  )

  async function savePlan(payload) {
    if (editingPlan) await updateSubscriptionPlan(editingPlan.id, payload)
    else await createSubscriptionPlan(payload)
    await loadPlans()
    setEditingPlan(null)
    setShowCreate(false)
  }

  async function togglePlan(plan) {
    setError('')
    try {
      if (plan.isActive) await deactivateSubscriptionPlan(plan.id)
      else await updateSubscriptionPlan(plan.id, { isActive: true })
      await loadPlans()
    } catch (requestError) {
      setError(getPlatformErrorMessage(requestError))
    }
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Plans" value={plans.length} />
        <SummaryCard label="Active Plans" value={plans.filter((item) => item.isActive).length} tone="success" />
        <SummaryCard label="Inactive Plans" value={plans.filter((item) => !item.isActive).length} tone="warning" />
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <Section
        title="Subscription Plan List"
        subtitle="Database-backed subscription plans and tenant limits."
        actions={<div className="flex flex-col gap-3 sm:flex-row"><FilterBar search={search} onSearch={setSearch} placeholder="Search plans" /><button className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white" onClick={() => setShowCreate(true)}><Plus size={16} /> Add Plan</button></div>}
      >
        <TableShell columns={['Plan', 'Billing Cycle', 'Base Price', 'Users', 'Vehicles', 'Bookings', 'Storage', 'Trial', 'Status', 'Actions']} minWidth="1150px" empty={rows.length === 0}>
          {rows.map((plan) => (
            <tr key={plan.id} className="hover:bg-slate-50">
              <td className="px-4 py-3"><p className="font-semibold text-slate-950">{plan.name}</p><p className="text-xs text-slate-500">{plan.code} • {plan.description}</p></td>
              <td className="px-4 py-3 text-slate-700">{plan.billingCycle}</td>
              <td className="px-4 py-3 font-semibold text-slate-900">{Number(plan.basePrice) ? `₹ ${money(Number(plan.basePrice))}` : 'Custom'}</td>
              <td className="px-4 py-3 text-slate-700">{plan.userLimit ?? 'Custom'}</td>
              <td className="px-4 py-3 text-slate-700">{plan.vehicleLimit ?? 'Custom'}</td>
              <td className="px-4 py-3 text-slate-700">{plan.bookingLimit ?? 'Custom'}</td>
              <td className="px-4 py-3 text-slate-700">{plan.storageLimitMb ?? 'Custom'}</td>
              <td className="px-4 py-3 text-slate-700">{plan.trialDays} days</td>
              <td className="px-4 py-3"><StatusBadge status={plan.isActive ? 'ACTIVE' : 'INACTIVE'} /></td>
              <td className="px-4 py-3"><div className="flex gap-2"><button className="rounded-lg border border-slate-200 p-2" onClick={() => setEditingPlan(plan)} aria-label={`Edit ${plan.name}`}><Pencil size={14} /></button><button className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold" onClick={() => togglePlan(plan)}>{plan.isActive ? 'Deactivate' : 'Activate'}</button></div></td>
            </tr>
          ))}
        </TableShell>
      </Section>
      {(showCreate || editingPlan) && <PlanModal plan={editingPlan} onClose={() => { setShowCreate(false); setEditingPlan(null) }} onSave={savePlan} />}
    </div>
  )
}

export default PlansPage
