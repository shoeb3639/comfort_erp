import type { Request } from 'express'
import { rateLimit } from 'express-rate-limit'
import { env } from '../config/env'
import {
  RATE_LIMIT_ERROR_CODE,
  RATE_LIMIT_MESSAGES,
  RATE_LIMIT_POLICIES,
} from '../shared/security/rate-limit.constants'

interface RateLimitPolicyOptions {
  identifier: string
  limit: number
  message: string
  windowMs: number
  skip?: (request: Request) => boolean
  skipSuccessfulRequests?: boolean
}

export function createRateLimitMiddleware(options: RateLimitPolicyOptions) {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    identifier: options.identifier,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests: options.skipSuccessfulRequests ?? false,
    ...(options.skip ? { skip: options.skip } : {}),
    handler: (_request, response) => {
      response.status(429).json({
        success: false,
        message: options.message,
        code: RATE_LIMIT_ERROR_CODE,
        details: [],
      })
    },
  })
}

export const globalRateLimiter = createRateLimitMiddleware({
  identifier: RATE_LIMIT_POLICIES.global,
  windowMs: env.rateLimit.global.windowMs,
  limit: env.rateLimit.global.limit,
  message: RATE_LIMIT_MESSAGES.global,
  skip: (request) => request.path === '/public/health',
})

export const authenticationRateLimiter = createRateLimitMiddleware({
  identifier: RATE_LIMIT_POLICIES.authentication,
  windowMs: env.rateLimit.authentication.windowMs,
  limit: env.rateLimit.authentication.limit,
  message: RATE_LIMIT_MESSAGES.authentication,
  skipSuccessfulRequests: true,
})
