import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { getAuthErrorMessage } from '../../services/auth'

function LoginPage() {
  const { isAuthenticated, isInitializing, signIn, user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isInitializing && isAuthenticated) {
    return <Navigate to={user.userType === 'PLATFORM' ? '/platform/dashboard' : '/dashboard'} replace />
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const session = await signIn({ email, password })
      const requestedPath = location.state?.from?.pathname
      const permittedRequestedPath =
        session.user.userType === 'PLATFORM' ? requestedPath?.startsWith('/platform') : requestedPath && !requestedPath.startsWith('/platform')
      navigate(permittedRequestedPath ? requestedPath : session.user.userType === 'PLATFORM' ? '/platform/dashboard' : '/dashboard', {
        replace: true,
      })
    } catch (requestError) {
      setError(getAuthErrorMessage(requestError))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <p className="text-sm font-semibold uppercase text-brand-600">Ops Hub</p>
          <h1 className="mt-1 text-2xl font-semibold text-slate-950">Sign in to Booking Admin</h1>
          <p className="mt-2 text-sm text-slate-500">Access dispatch, billing, and reporting tools.</p>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Email</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@example.com"
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Password</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
            />
          </label>
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
          <button disabled={isSubmitting} className="w-full rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60">
            {isSubmitting ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </section>
    </main>
  )
}

export default LoginPage
