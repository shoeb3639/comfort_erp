import { Section, SummaryCard } from './platformUtils'

function PlatformSettingsPage() {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Platform Name" value="Cablix" />
        <SummaryCard label="Owner Scope" value="PLATFORM" caption="Cablix is not a tenant" />
        <SummaryCard label="Tenant Access Policy" value="Grace Period" />
      </div>

      <Section title="Platform Settings" subtitle="Static frontend placeholder for future backend configuration.">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="rounded-xl border border-slate-200 p-4">
            <span className="text-sm font-semibold text-slate-900">Allow expired tenant login</span>
            <span className="mt-1 block text-sm text-slate-500">Expired tenants can login, download old invoices/reports, and renew subscription.</span>
            <input className="mt-4 h-4 w-4 rounded border-slate-300" type="checkbox" defaultChecked />
          </label>
          <label className="rounded-xl border border-slate-200 p-4">
            <span className="text-sm font-semibold text-slate-900">Disable writes after expiry</span>
            <span className="mt-1 block text-sm text-slate-500">New bookings, invoices, and accounting writes are blocked after expiry.</span>
            <input className="mt-4 h-4 w-4 rounded border-slate-300" type="checkbox" defaultChecked />
          </label>
          <label className="rounded-xl border border-slate-200 p-4">
            <span className="text-sm font-semibold text-slate-900">Default trial period</span>
            <span className="mt-1 block text-sm text-slate-500">14 days</span>
            <input className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" defaultValue="14" />
          </label>
          <label className="rounded-xl border border-slate-200 p-4">
            <span className="text-sm font-semibold text-slate-900">Default grace period</span>
            <span className="mt-1 block text-sm text-slate-500">3 days after subscription expiry</span>
            <input className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" defaultValue="3" />
          </label>
        </div>
      </Section>
    </div>
  )
}

export default PlatformSettingsPage
