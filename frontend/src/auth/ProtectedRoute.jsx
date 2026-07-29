import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

function LoadingSession() {
  return <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-600">Checking your session…</div>
}

export default function ProtectedRoute({ userType }) {
  const {
    isAuthenticated,
    isInitializing,
    user,
    validateAccess,
  } = useAuth()
  const location = useLocation()
  const [validatedPath, setValidatedPath] = useState('')
  const [isValidatingAccess, setIsValidatingAccess] = useState(false)

  useEffect(() => {
    if (
      isInitializing ||
      !isAuthenticated ||
      userType !== 'TENANT' ||
      user?.userType !== 'TENANT'
    ) {
      return
    }

    let active = true
    setIsValidatingAccess(true)
    validateAccess()
      .then((allowed) => {
        if (active && allowed) setValidatedPath(location.pathname)
      })
      .finally(() => {
        if (active) setIsValidatingAccess(false)
      })

    return () => {
      active = false
    }
  }, [
    isAuthenticated,
    isInitializing,
    location.pathname,
    user?.userType,
    userType,
    validateAccess,
  ])

  if (isInitializing) return <LoadingSession />
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location }} />
  if (user?.userType !== userType) {
    return <Navigate to={user?.userType === 'PLATFORM' ? '/platform/dashboard' : '/dashboard'} replace />
  }
  if (
    userType === 'TENANT' &&
    (isValidatingAccess || validatedPath !== location.pathname)
  ) {
    return <LoadingSession />
  }

  return <Outlet />
}
