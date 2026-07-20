import { Link } from 'react-router-dom'
import { Building2, ReceiptText, ShieldCheck, SlidersHorizontal, Users } from 'lucide-react'

const settingsCards = [
  {
    title: 'GST Registrations',
    description: 'Manage GSTIN, legal names, state code, defaults, and branch mapping.',
    to: '/settings/gst-registrations',
    icon: ReceiptText,
  },
  {
    title: 'Users',
    description: 'Manage ERP users, branch assignment, account status, and role mapping.',
    to: '/settings/users',
    icon: Users,
  },
  {
    title: 'Roles',
    description: 'Create role collections for operations, accounting, fleet, and admin teams.',
    to: '/settings/roles',
    icon: ShieldCheck,
  },
  {
    title: 'Permissions',
    description: 'Review permission keys prepared for future route and action guards.',
    to: '/settings/permissions',
    icon: SlidersHorizontal,
  },
]

function SettingsPage() {
  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {settingsCards.map((item) => {
          const Icon = item.icon

          return (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <Icon size={20} strokeWidth={2.2} />
              </div>
              <h3 className="mt-4 text-base font-semibold text-slate-950">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">{item.description}</p>
            </Link>
          )
        })}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
            <Building2 size={20} strokeWidth={2.2} />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-950">General Settings</h3>
            <p className="mt-1 text-sm text-slate-500">Operational defaults used across the current mock ERP workspace.</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="rounded-xl border border-slate-200 p-4">
            <span className="text-sm font-medium text-slate-900">Email notifications</span>
            <span className="mt-1 block text-sm text-slate-500">Send booking updates to administrators.</span>
            <input className="mt-4 h-4 w-4 rounded border-slate-300" type="checkbox" defaultChecked />
          </label>
          <label className="rounded-xl border border-slate-200 p-4">
            <span className="text-sm font-medium text-slate-900">Vendor approval</span>
            <span className="mt-1 block text-sm text-slate-500">Require approval before assigning vendors.</span>
            <input className="mt-4 h-4 w-4 rounded border-slate-300" type="checkbox" />
          </label>
        </div>
      </section>
    </div>
  )
}

export default SettingsPage
