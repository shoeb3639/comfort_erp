import type { RequestHandler } from 'express'
import * as authRepository from '../modules/auth/auth.repository'
import { AppError } from '../shared/errors/app-error'
import { verifyAccessToken } from '../shared/security/tokens'

function bearerToken(header: string | undefined): string {
  if (!header?.startsWith('Bearer ')) {
    throw new AppError('Authentication is required', 'UNAUTHORIZED', 401)
  }
  const token = header.slice('Bearer '.length).trim()
  if (!token) {
    throw new AppError('Authentication is required', 'UNAUTHORIZED', 401)
  }
  return token
}

export const authenticateUser: RequestHandler = async (
  request,
  _response,
  next,
) => {
  const auth = verifyAccessToken(bearerToken(request.get('authorization')))

  if (auth.userType === 'PLATFORM') {
    const user = await authRepository.findPlatformUserStatus(auth.userId)
    if (!user || user.status !== 'ACTIVE' || user.roleId !== auth.roleId) {
      throw new AppError('User account is not active', 'UNAUTHORIZED', 401)
    }
    auth.permissions = user.role.permissions.map(
      (item) => item.permission.permissionKey,
    )
  } else {
    const user = await authRepository.findTenantUserStatus(
      auth.tenantId!,
      auth.userId,
    )
    if (
      !user ||
      user.status !== 'ACTIVE' ||
      user.deletedAt ||
      user.roleId !== auth.roleId
    ) {
      throw new AppError('User account is not active', 'UNAUTHORIZED', 401)
    }
    auth.permissions = user.role.permissions.map(
      (item) => item.permission.permissionKey,
    )
  }

  request.auth = auth
  next()
}
