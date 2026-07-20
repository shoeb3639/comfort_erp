import { getMockData } from './api'

export function getCurrentUser() {
  return getMockData('users')[0] || null
}

export function getRolePermissionKeys(roleId) {
  const rolePermissionRows = getMockData('rolePermissions')
  const permissions = getMockData('permissions')
  const permissionById = Object.fromEntries(permissions.map((permission) => [permission.id, permission]))

  return rolePermissionRows
    .filter((row) => row.role_id === roleId)
    .map((row) => permissionById[row.permission_id]?.permission_key)
    .filter(Boolean)
}

export function can(permissionKey, user = getCurrentUser()) {
  if (!user || user.status !== 'Active') return false
  return getRolePermissionKeys(user.role_id).includes(permissionKey)
}
