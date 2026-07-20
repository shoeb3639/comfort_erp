export const fieldClass =
  'mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100'

export const readOnlyClass =
  'rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-800'

export function toNumber(value) {
  if (typeof value === 'number') return value
  return Number(String(value || 0).replace(/[^0-9.-]/g, '')) || 0
}

export function money(value) {
  return Number(value || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  })
}

export function formatLabel(value) {
  return value ? String(value).replaceAll('_', ' ') : '-'
}

export function StatusBadge({ status }) {
  const tone =
    ['Verified', 'Closed', 'Settled', 'Approved'].includes(status)
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
      : ['Open', 'Review', 'With Manager', 'Pending', 'Collected'].includes(status)
        ? 'bg-amber-50 text-amber-700 ring-amber-600/20'
        : ['Deposited', 'Partially Used'].includes(status)
          ? 'bg-brand-50 text-brand-700 ring-brand-600/20'
          : 'bg-slate-100 text-slate-700 ring-slate-500/20'

  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${tone}`}>{status || '-'}</span>
}

export function SummaryCard({ label, value, tone = 'default', prefix = '₹ ' }) {
  const toneClass =
    tone === 'success'
      ? 'text-emerald-700'
      : tone === 'danger'
        ? 'text-rose-700'
        : tone === 'warning'
          ? 'text-amber-700'
          : 'text-slate-950'

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-3 text-2xl font-bold ${toneClass}`}>{prefix}{typeof value === 'number' ? money(value) : value}</p>
    </div>
  )
}

export function Section({ title, children, actions = null }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        {actions}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

export function FilterBar({ search, onSearch, children }) {
  return (
    <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
      <input
        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 sm:w-72"
        value={search}
        onChange={(event) => onSearch(event.target.value)}
        placeholder="Search records"
      />
      <div className="flex flex-wrap gap-3">{children}</div>
    </div>
  )
}

export function TableShell({ columns, children, minWidth = '1100px', empty = false, emptyText = 'No records found.' }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full divide-y divide-slate-200 text-sm" style={{ minWidth }}>
        <thead className="bg-slate-50">
          <tr>
            {columns.map((column) => (
              <th key={column} className="px-4 py-3 text-left font-semibold text-slate-700">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">{children}</tbody>
      </table>
      {empty && <div className="bg-white px-4 py-10 text-center text-sm text-slate-500">{emptyText}</div>}
    </div>
  )
}

export function ReadOnlyField({ label, value }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={readOnlyClass}>{value || '-'}</p>
    </div>
  )
}
