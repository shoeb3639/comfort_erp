import { env } from '../../config/env'
import { AppError } from '../../shared/errors/app-error'
import { verifyPassword } from '../../shared/security/password'
import {
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../../shared/security/tokens'
import * as authRepository from './auth.repository'
import type { AuthContext, AuthenticatedUser } from './auth.types'

interface SessionMetadata {
  ipAddress: string | null
  userAgent: string | null
}

interface AuthResult {
  accessToken: string
  refreshToken: string
  expiresIn: number
  user: AuthenticatedUser
}

function platformPermissions(
  user: NonNullable<
    Awaited<ReturnType<typeof authRepository.findPlatformUserByEmail>>
  >,
): string[] {
  return user.role.permissions.map((item) => item.permission.permissionKey)
}

function tenantPermissions(
  user: Awaited<
    ReturnType<typeof authRepository.findTenantUsersByEmail>
  >[number],
): string[] {
  return user.role.permissions.map((item) => item.permission.permissionKey)
}

function ensureActiveUser(status: string): void {
  if (status !== 'ACTIVE') {
    throw new AppError('User account is not active', 'FORBIDDEN', 403)
  }
}

function ensureTenantCanAuthenticate(status: string): void {
  if (status === 'SUSPENDED') {
    throw new AppError('Tenant account is suspended', 'TENANT_SUSPENDED', 403)
  }
  if (status === 'CLOSED') {
    throw new AppError('Tenant account is closed', 'FORBIDDEN', 403)
  }
}

function buildResult(
  user: AuthenticatedUser,
  refreshToken: string,
): AuthResult {
  const context: AuthContext = {
    userId: user.id,
    userType: user.userType,
    tenantId: user.tenantId,
    roleId: user.roleId,
    permissions: user.permissions,
  }
  return {
    accessToken: signAccessToken(context),
    refreshToken,
    expiresIn: env.accessTokenTtlSeconds,
    user,
  }
}

export async function login(
  email: string,
  password: string,
  metadata: SessionMetadata,
): Promise<AuthResult> {
  const normalizedEmail = email.trim().toLowerCase()
  const [platformUser, tenantUsers] = await Promise.all([
    authRepository.findPlatformUserByEmail(normalizedEmail),
    authRepository.findTenantUsersByEmail(normalizedEmail),
  ])
  const matches: Array<
    | { type: 'PLATFORM'; user: NonNullable<typeof platformUser> }
    | { type: 'TENANT'; user: (typeof tenantUsers)[number] }
  > = []

  if (
    platformUser &&
    (await verifyPassword(platformUser.passwordHash, password))
  ) {
    matches.push({ type: 'PLATFORM', user: platformUser })
  }
  for (const tenantUser of tenantUsers) {
    if (await verifyPassword(tenantUser.passwordHash, password)) {
      matches.push({ type: 'TENANT', user: tenantUser })
    }
  }

  if (matches.length === 0) {
    throw new AppError('Invalid email or password', 'UNAUTHORIZED', 401)
  }
  if (matches.length > 1) {
    throw new AppError(
      'Login matches more than one account; contact support',
      'CONFLICT',
      409,
    )
  }

  const match = matches[0]!
  ensureActiveUser(match.user.status)

  if (match.type === 'PLATFORM') {
    const refresh = signRefreshToken({
      userId: match.user.id,
      userType: 'PLATFORM',
      tenantId: null,
    })
    await Promise.all([
      authRepository.createPlatformRefreshToken({
        platformUserId: match.user.id,
        tokenHash: hashToken(refresh.token),
        expiresAt: refresh.expiresAt,
        ...metadata,
      }),
      authRepository.updatePlatformLastLogin(match.user.id),
    ])
    return buildResult(
      {
        id: match.user.id,
        name: match.user.name,
        email: match.user.email,
        userType: 'PLATFORM',
        tenantId: null,
        roleId: match.user.roleId,
        permissions: platformPermissions(match.user),
      },
      refresh.token,
    )
  }

  ensureTenantCanAuthenticate(match.user.tenant.status)
  const refresh = signRefreshToken({
    userId: match.user.id,
    userType: 'TENANT',
    tenantId: match.user.tenantId,
  })
  await Promise.all([
    authRepository.createTenantRefreshToken({
      tenantId: match.user.tenantId,
      userId: match.user.id,
      tokenHash: hashToken(refresh.token),
      expiresAt: refresh.expiresAt,
      ...metadata,
    }),
    authRepository.updateTenantLastLogin(match.user.tenantId, match.user.id),
  ])
  return buildResult(
    {
      id: match.user.id,
      name: match.user.name,
      email: match.user.email,
      userType: 'TENANT',
      tenantId: match.user.tenantId,
      roleId: match.user.roleId,
      permissions: tenantPermissions(match.user),
    },
    refresh.token,
  )
}

export async function refreshSession(
  currentToken: string,
  metadata: SessionMetadata,
): Promise<AuthResult> {
  const claims = verifyRefreshToken(currentToken)
  const currentHash = hashToken(currentToken)

  if (claims.user_type === 'PLATFORM') {
    const record = await authRepository.findPlatformRefreshToken(currentHash)
    if (
      !record ||
      record.revokedAt ||
      record.expiresAt <= new Date() ||
      record.platformUserId !== claims.user_id
    ) {
      throw new AppError(
        'Invalid or expired refresh token',
        'UNAUTHORIZED',
        401,
      )
    }
    ensureActiveUser(record.platformUser.status)
    const next = signRefreshToken({
      userId: record.platformUser.id,
      userType: 'PLATFORM',
      tenantId: null,
    })
    const rotated = await authRepository.rotatePlatformRefreshToken({
      currentTokenId: record.id,
      platformUserId: record.platformUser.id,
      tokenHash: hashToken(next.token),
      expiresAt: next.expiresAt,
      ...metadata,
    })
    if (!rotated) {
      throw new AppError(
        'Refresh token has already been used',
        'UNAUTHORIZED',
        401,
      )
    }
    return buildResult(
      {
        id: record.platformUser.id,
        name: record.platformUser.name,
        email: record.platformUser.email,
        userType: 'PLATFORM',
        tenantId: null,
        roleId: record.platformUser.roleId,
        permissions: platformPermissions(record.platformUser),
      },
      next.token,
    )
  }

  const record = await authRepository.findTenantRefreshToken(currentHash)
  if (
    !record ||
    record.revokedAt ||
    record.expiresAt <= new Date() ||
    record.userId !== claims.user_id ||
    record.tenantId !== claims.tenant_id
  ) {
    throw new AppError('Invalid or expired refresh token', 'UNAUTHORIZED', 401)
  }
  ensureActiveUser(record.user.status)
  ensureTenantCanAuthenticate(record.user.tenant.status)
  const next = signRefreshToken({
    userId: record.user.id,
    userType: 'TENANT',
    tenantId: record.user.tenantId,
  })
  const rotated = await authRepository.rotateTenantRefreshToken({
    currentTokenId: record.id,
    tenantId: record.user.tenantId,
    userId: record.user.id,
    tokenHash: hashToken(next.token),
    expiresAt: next.expiresAt,
    ...metadata,
  })
  if (!rotated) {
    throw new AppError(
      'Refresh token has already been used',
      'UNAUTHORIZED',
      401,
    )
  }
  return buildResult(
    {
      id: record.user.id,
      name: record.user.name,
      email: record.user.email,
      userType: 'TENANT',
      tenantId: record.user.tenantId,
      roleId: record.user.roleId,
      permissions: tenantPermissions(record.user),
    },
    next.token,
  )
}

export async function logout(refreshToken: string): Promise<void> {
  const claims = verifyRefreshToken(refreshToken)
  const tokenHash = hashToken(refreshToken)
  if (claims.user_type === 'PLATFORM') {
    await authRepository.revokePlatformRefreshToken(tokenHash)
  } else {
    await authRepository.revokeTenantRefreshToken(tokenHash)
  }
}
