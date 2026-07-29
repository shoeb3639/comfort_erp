import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import * as authService from '../services/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [isInitializing, setIsInitializing] = useState(true)

  useEffect(() => {
    let active = true

    async function restoreSession() {
      const storedSession = authService.readStoredSession()

      if (!storedSession?.accessToken || !storedSession?.refreshToken || !storedSession?.user) {
        authService.clearSession()
        if (active) setIsInitializing(false)
        return
      }

      try {
        await authService.validateSession(storedSession)
        if (active) setSession(storedSession)
      } catch {
        let refreshedSession = null
        try {
          refreshedSession = await authService.refreshSession(storedSession.refreshToken)
          await authService.validateSession(refreshedSession)
          authService.storeSession(refreshedSession)
          if (active) setSession(refreshedSession)
        } catch {
          if (refreshedSession?.refreshToken) {
            try {
              await authService.logout(refreshedSession.refreshToken)
            } catch {
              // Local access remains denied even if server revocation fails.
            }
          }
          authService.clearSession()
        }
      } finally {
        if (active) setIsInitializing(false)
      }
    }

    restoreSession()
    return () => {
      active = false
    }
  }, [])

  async function signIn(credentials) {
    const nextSession = await authService.login(credentials)
    try {
      await authService.validateSession(nextSession)
    } catch (validationError) {
      try {
        await authService.logout(nextSession.refreshToken)
      } catch {
        // The rejected session is never stored even if token revocation fails.
      }
      throw validationError
    }
    authService.storeSession(nextSession)
    setSession(nextSession)
    return nextSession
  }

  const validateAccess = useCallback(async () => {
    if (!session) return false
    try {
      await authService.validateSession(session)
      return true
    } catch {
      authService.clearSession()
      setSession(null)
      return false
    }
  }, [session])

  async function signOut() {
    const refreshToken = session?.refreshToken
    authService.clearSession()
    setSession(null)
    try {
      await authService.logout(refreshToken)
    } catch {
      // The local session is cleared even if the server is unavailable.
    }
  }

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      isAuthenticated: Boolean(session),
      isInitializing,
      signIn,
      signOut,
      validateAccess,
    }),
    [session, isInitializing, validateAccess],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
