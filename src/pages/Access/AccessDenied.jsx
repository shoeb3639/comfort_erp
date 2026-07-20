import { Link } from 'react-router-dom'

function AccessDeniedPage() {
  return (
    <div className="rounded-2xl border border-rose-200 bg-white p-8 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-wide text-rose-600">Access Denied</p>
      <h3 className="mt-2 text-2xl font-bold text-slate-950">You do not have permission to view this page.</h3>
      <p className="mt-3 max-w-2xl text-sm text-slate-600">
        This screen is ready for future permission-based route guards. Access should be checked with permission keys such as
        <code className="mx-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold">booking.view</code>
        or
        <code className="mx-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold">invoice.generate</code>
        instead of role-name checks.
      </p>
      <Link className="mt-6 inline-flex rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600" to="/dashboard">
        Back to Dashboard
      </Link>
    </div>
  )
}

export default AccessDeniedPage
