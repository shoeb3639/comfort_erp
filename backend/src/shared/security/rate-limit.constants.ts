export const RATE_LIMIT_DEFAULTS = Object.freeze({
  global: Object.freeze({
    windowMs: 15 * 60 * 1000,
    limit: 300,
  }),
  authentication: Object.freeze({
    windowMs: 15 * 60 * 1000,
    limit: 20,
  }),
})

export const RATE_LIMIT_POLICIES = Object.freeze({
  global: 'global',
  authentication: 'authentication',
})

export const RATE_LIMIT_MESSAGES = Object.freeze({
  global: 'Too many requests. Please try again later.',
  authentication: 'Too many authentication attempts. Please try again later.',
})

export const RATE_LIMIT_ERROR_CODE = 'RATE_LIMITED'
