export type UserType = 'PLATFORM' | 'TENANT'

export interface AuthContext {
  userId: string
  userType: UserType
  tenantId: string | null
  roleId: string
  permissions: string[]
}

export interface TenantContext {
  id: string
  code: string
  status: 'PENDING_SETUP' | 'ACTIVE' | 'SUSPENDED' | 'CLOSED'
}

export interface AccessTokenClaims {
  user_id: string
  user_type: UserType
  tenant_id: string | null
  role_id: string
  permissions: string[]
  token_type: 'access'
}

export interface RefreshTokenClaims {
  user_id: string
  user_type: UserType
  tenant_id: string | null
  token_type: 'refresh'
  jti: string
}

export interface AuthenticatedUser {
  id: string
  name: string
  email: string
  userType: UserType
  tenantId: string | null
  roleId: string
  permissions: string[]
}
