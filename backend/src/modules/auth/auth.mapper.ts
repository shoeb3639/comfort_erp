import type { AuthenticatedUser } from './auth.types'

export function mapAuthenticatedUser(user: AuthenticatedUser) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    userType: user.userType,
    tenantId: user.tenantId,
    roleId: user.roleId,
    permissions: user.permissions,
  }
}
