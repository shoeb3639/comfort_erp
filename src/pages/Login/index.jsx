import { Link } from 'react-router-dom'

function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <p className="text-sm font-semibold uppercase text-brand-600">Ops Hub</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">Sign in to Booking Admin</h1>
          <p className="mt-2 text-sm text-slate-500">Access dispatch, billing, and reporting tools.</p>
        </div>

        <form className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Email</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              type="email"
              placeholder="admin@example.com"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Password</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              type="password"
              placeholder="Password"
            />
          </label>
          <button className="w-full rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600">
            Sign In
          </button>
        </form>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Link className="rounded-lg border border-slate-200 px-4 py-2 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50" to="/platform/dashboard">
            Platform Admin
          </Link>
          <Link className="rounded-lg border border-slate-200 px-4 py-2 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50" to="/dashboard">
            Tenant ERP
          </Link>
        </div>
      </section>
    </main>
  )
}

export default LoginPage
