import type { AuthContext, TenantContext } from '../modules/auth/auth.types'

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext
      tenant?: TenantContext
    }
  }
}

export {}
