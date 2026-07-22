import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

function LoadingSession() {
  return <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-600">Checking your session…</div>
}

export default function ProtectedRoute({ userType }) {
  const { isAuthenticated, isInitializing, user } = useAuth()
  const location = useLocation()

  if (isInitializing) return <LoadingSession />
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />
  if (user?.userType !== userType) {
    return <Navigate to={user?.userType === 'PLATFORM' ? '/platform/dashboard' : '/dashboard'} replace />
  }

  return <Outlet />
}
