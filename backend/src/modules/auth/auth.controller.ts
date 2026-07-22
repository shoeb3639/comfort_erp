import type { RequestHandler } from 'express'
import { mapAuthenticatedUser } from './auth.mapper'
import * as authService from './auth.service'

function sessionMetadata(request: Parameters<RequestHandler>[0]) {
  return {
    ipAddress: request.ip ?? null,
    userAgent: request.get('user-agent') ?? null,
  }
}

interface LoginBody {
  email: string
  password: string
}

interface RefreshTokenBody {
  refreshToken: string
}

export const login: RequestHandler = async (request, response) => {
  const body = request.body as LoginBody
  const result = await authService.login(
    body.email,
    body.password,
    sessionMetadata(request),
  )
  response.status(200).json({
    success: true,
    data: {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
      user: mapAuthenticatedUser(result.user),
    },
    message: 'Login successful',
  })
}

export const refresh: RequestHandler = async (request, response) => {
  const body = request.body as RefreshTokenBody
  const result = await authService.refreshSession(
    body.refreshToken,
    sessionMetadata(request),
  )
  response.status(200).json({
    success: true,
    data: {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
      user: mapAuthenticatedUser(result.user),
    },
    message: 'Session refreshed',
  })
}

export const logout: RequestHandler = async (request, response) => {
  const body = request.body as RefreshTokenBody
  await authService.logout(body.refreshToken)
  response.status(200).json({
    success: true,
    data: null,
    message: 'Logout successful',
  })
}
