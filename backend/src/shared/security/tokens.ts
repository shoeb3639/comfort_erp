import { createHash, randomUUID } from 'node:crypto'
import jwt, { type JwtPayload } from 'jsonwebtoken'
import { env } from '../../config/env'
import type {
  AccessTokenClaims,
  AuthContext,
  RefreshTokenClaims,
  UserType,
} from '../../modules/auth/auth.types'
import { AppError } from '../errors/app-error'

const algorithm = 'HS256' as const

function assertString(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new AppError('Invalid or expired token', 'UNAUTHORIZED', 401)
  }
  return value
}

function assertUserType(value: unknown): UserType {
  if (value !== 'PLATFORM' && value !== 'TENANT') {
    throw new AppError('Invalid or expired token', 'UNAUTHORIZED', 401)
  }
  return value
}

function assertPayload(value: string | JwtPayload): JwtPayload {
  if (typeof value === 'string') {
    throw new AppError('Invalid or expired token', 'UNAUTHORIZED', 401)
  }
  return value
}

export function signAccessToken(context: AuthContext): string {
  const payload: AccessTokenClaims = {
    user_id: context.userId,
    user_type: context.userType,
    tenant_id: context.tenantId,
    role_id: context.roleId,
    permissions: context.permissions,
    token_type: 'access',
  }

  return jwt.sign(payload, env.jwtAccessSecret, {
    algorithm,
    audience: env.jwtAudience,
    expiresIn: env.accessTokenTtlSeconds,
    issuer: env.jwtIssuer,
    subject: context.userId,
  })
}

export function signRefreshToken(input: {
  userId: string
  userType: UserType
  tenantId: string | null
}): { token: string; expiresAt: Date } {
  const jti = randomUUID()
  const payload: Omit<RefreshTokenClaims, 'jti'> = {
    user_id: input.userId,
    user_type: input.userType,
    tenant_id: input.tenantId,
    token_type: 'refresh',
  }
  const token = jwt.sign(payload, env.jwtRefreshSecret, {
    algorithm,
    audience: env.jwtAudience,
    expiresIn: env.refreshTokenTtlSeconds,
    issuer: env.jwtIssuer,
    jwtid: jti,
    subject: input.userId,
  })

  return {
    token,
    expiresAt: new Date(Date.now() + env.refreshTokenTtlSeconds * 1000),
  }
}

export function verifyAccessToken(token: string): AuthContext {
  try {
    const payload = assertPayload(
      jwt.verify(token, env.jwtAccessSecret, {
        algorithms: [algorithm],
        audience: env.jwtAudience,
        issuer: env.jwtIssuer,
      }),
    )

    if (
      payload.token_type !== 'access' ||
      !Array.isArray(payload.permissions)
    ) {
      throw new AppError('Invalid or expired token', 'UNAUTHORIZED', 401)
    }

    const userType = assertUserType(payload.user_type)
    const tenantId =
      payload.tenant_id === null ? null : assertString(payload.tenant_id)

    if (userType === 'TENANT' && tenantId === null) {
      throw new AppError('Invalid or expired token', 'UNAUTHORIZED', 401)
    }
    if (userType === 'PLATFORM' && tenantId !== null) {
      throw new AppError('Invalid or expired token', 'UNAUTHORIZED', 401)
    }

    return {
      userId: assertString(payload.user_id),
      userType,
      tenantId,
      roleId: assertString(payload.role_id),
      permissions: payload.permissions.map(assertString),
    }
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new AppError('Invalid or expired token', 'UNAUTHORIZED', 401)
  }
}

export function verifyRefreshToken(token: string): RefreshTokenClaims {
  try {
    const payload = assertPayload(
      jwt.verify(token, env.jwtRefreshSecret, {
        algorithms: [algorithm],
        audience: env.jwtAudience,
        issuer: env.jwtIssuer,
      }),
    )
    if (payload.token_type !== 'refresh') {
      throw new AppError(
        'Invalid or expired refresh token',
        'UNAUTHORIZED',
        401,
      )
    }

    const userType = assertUserType(payload.user_type)
    const tenantId =
      payload.tenant_id === null ? null : assertString(payload.tenant_id)

    if (userType === 'TENANT' && tenantId === null) {
      throw new AppError(
        'Invalid or expired refresh token',
        'UNAUTHORIZED',
        401,
      )
    }
    if (userType === 'PLATFORM' && tenantId !== null) {
      throw new AppError(
        'Invalid or expired refresh token',
        'UNAUTHORIZED',
        401,
      )
    }

    return {
      user_id: assertString(payload.user_id),
      user_type: userType,
      tenant_id: tenantId,
      token_type: 'refresh',
      jti: assertString(payload.jti),
    }
  } catch (error) {
    if (error instanceof AppError) throw error
    throw new AppError('Invalid or expired refresh token', 'UNAUTHORIZED', 401)
  }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
