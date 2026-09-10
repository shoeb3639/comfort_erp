import 'dotenv/config'
import Joi from 'joi'
import { isAbsolute, relative, resolve } from 'node:path'
import { RATE_LIMIT_DEFAULTS } from '../shared/security/rate-limit.constants'

interface EnvironmentVariables {
  NODE_ENV: 'development' | 'test' | 'production'
  PORT: number
  CORS_ORIGIN: string
  LOG_LEVEL: string
  TRUST_PROXY_HOPS: number
  DATABASE_URL: string
  JWT_ACCESS_SECRET: string
  JWT_REFRESH_SECRET: string
  ACCESS_TOKEN_TTL: number
  REFRESH_TOKEN_TTL: number
  JWT_ISSUER: string
  JWT_AUDIENCE: string
  RATE_LIMIT_GLOBAL_WINDOW_MS: number
  RATE_LIMIT_GLOBAL_MAX: number
  RATE_LIMIT_AUTH_WINDOW_MS: number
  RATE_LIMIT_AUTH_MAX: number
  STORAGE_DRIVER: 'local'
  STORAGE_LOCAL_ROOT: string
  STORAGE_TEMP_ROOT: string
  STORAGE_MAX_FILE_SIZE_MB: number
  STORAGE_MAX_FILES_PER_REQUEST: number
}

const envSchema = Joi.object<EnvironmentVariables>({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().port().default(8080),
  CORS_ORIGIN: Joi.string().default('http://localhost:5173'),
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'http', 'verbose', 'debug', 'silly')
    .default('info'),
  TRUST_PROXY_HOPS: Joi.number().integer().min(0).max(10).default(0),
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .required(),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  ACCESS_TOKEN_TTL: Joi.number().integer().positive().default(900),
  REFRESH_TOKEN_TTL: Joi.number().integer().positive().default(604800),
  JWT_ISSUER: Joi.string().default('cablix-api'),
  JWT_AUDIENCE: Joi.string().default('cablix-app'),
  RATE_LIMIT_GLOBAL_WINDOW_MS: Joi.number()
    .integer()
    .min(1000)
    .max(24 * 60 * 60 * 1000)
    .default(RATE_LIMIT_DEFAULTS.global.windowMs),
  RATE_LIMIT_GLOBAL_MAX: Joi.number()
    .integer()
    .min(1)
    .max(100_000)
    .default(RATE_LIMIT_DEFAULTS.global.limit),
  RATE_LIMIT_AUTH_WINDOW_MS: Joi.number()
    .integer()
    .min(1000)
    .max(24 * 60 * 60 * 1000)
    .default(RATE_LIMIT_DEFAULTS.authentication.windowMs),
  RATE_LIMIT_AUTH_MAX: Joi.number()
    .integer()
    .min(1)
    .max(10_000)
    .default(RATE_LIMIT_DEFAULTS.authentication.limit),
  STORAGE_DRIVER: Joi.string().valid('local').default('local'),
  STORAGE_LOCAL_ROOT: Joi.string().trim().min(1).default('./storage'),
  STORAGE_TEMP_ROOT: Joi.string().trim().min(1).default('./storage-temp'),
  STORAGE_MAX_FILE_SIZE_MB: Joi.number().integer().min(1).max(100).default(10),
  STORAGE_MAX_FILES_PER_REQUEST: Joi.number()
    .integer()
    .min(1)
    .max(20)
    .default(5),
})
  .unknown(true)
  .required()

const validationResult = envSchema.validate(process.env, {
  abortEarly: false,
  convert: true,
})

if (validationResult.error) {
  throw new Error(
    `Invalid environment configuration: ${validationResult.error.message}`,
  )
}

const validatedEnvironment = validationResult.value

if (validatedEnvironment.NODE_ENV === 'production') {
  const applicationRoot = resolve(process.cwd())
  for (const [name, value] of [
    ['STORAGE_LOCAL_ROOT', validatedEnvironment.STORAGE_LOCAL_ROOT],
    ['STORAGE_TEMP_ROOT', validatedEnvironment.STORAGE_TEMP_ROOT],
  ] as const) {
    const resolved = resolve(value)
    const relativeToApplication = relative(applicationRoot, resolved)
    if (
      !isAbsolute(value) ||
      (!relativeToApplication.startsWith('..') && relativeToApplication !== '')
    )
      throw new Error(
        `${name} must be an absolute path outside the application directory in production`,
      )
  }
}
if (
  resolve(validatedEnvironment.STORAGE_LOCAL_ROOT) ===
  resolve(validatedEnvironment.STORAGE_TEMP_ROOT)
)
  throw new Error('STORAGE_LOCAL_ROOT and STORAGE_TEMP_ROOT must be different')
const databaseName = decodeURIComponent(
  new URL(validatedEnvironment.DATABASE_URL).pathname.replace(/^\//, ''),
)

if (
  validatedEnvironment.NODE_ENV === 'test' &&
  databaseName !== 'cablix_erp_test'
) {
  throw new Error(
    `Test processes are locked to cablix_erp_test; received ${databaseName || 'an empty database name'}`,
  )
}

if (
  validatedEnvironment.NODE_ENV !== 'test' &&
  databaseName === 'cablix_erp_test'
) {
  throw new Error(
    'The application cannot use cablix_erp_test outside test mode',
  )
}

interface Environment {
  nodeEnv: 'development' | 'test' | 'production'
  port: number
  corsOrigin: string
  logLevel: string
  trustProxyHops: number
  databaseUrl: string
  jwtAccessSecret: string
  jwtRefreshSecret: string
  accessTokenTtlSeconds: number
  refreshTokenTtlSeconds: number
  jwtIssuer: string
  jwtAudience: string
  rateLimit: {
    global: { windowMs: number; limit: number }
    authentication: { windowMs: number; limit: number }
  }
  storage: {
    driver: 'local'
    localRoot: string
    tempRoot: string
    maxFileSizeBytes: number
    maxFilesPerRequest: number
  }
}

export const env: Environment = Object.freeze({
  nodeEnv: validatedEnvironment.NODE_ENV,
  port: validatedEnvironment.PORT,
  corsOrigin: validatedEnvironment.CORS_ORIGIN,
  logLevel: validatedEnvironment.LOG_LEVEL,
  trustProxyHops: validatedEnvironment.TRUST_PROXY_HOPS,
  databaseUrl: validatedEnvironment.DATABASE_URL,
  jwtAccessSecret: validatedEnvironment.JWT_ACCESS_SECRET,
  jwtRefreshSecret: validatedEnvironment.JWT_REFRESH_SECRET,
  accessTokenTtlSeconds: validatedEnvironment.ACCESS_TOKEN_TTL,
  refreshTokenTtlSeconds: validatedEnvironment.REFRESH_TOKEN_TTL,
  jwtIssuer: validatedEnvironment.JWT_ISSUER,
  jwtAudience: validatedEnvironment.JWT_AUDIENCE,
  rateLimit: Object.freeze({
    global: Object.freeze({
      windowMs: validatedEnvironment.RATE_LIMIT_GLOBAL_WINDOW_MS,
      limit: validatedEnvironment.RATE_LIMIT_GLOBAL_MAX,
    }),
    authentication: Object.freeze({
      windowMs: validatedEnvironment.RATE_LIMIT_AUTH_WINDOW_MS,
      limit: validatedEnvironment.RATE_LIMIT_AUTH_MAX,
    }),
  }),
  storage: Object.freeze({
    driver: validatedEnvironment.STORAGE_DRIVER,
    localRoot: validatedEnvironment.STORAGE_LOCAL_ROOT,
    tempRoot: validatedEnvironment.STORAGE_TEMP_ROOT,
    maxFileSizeBytes:
      validatedEnvironment.STORAGE_MAX_FILE_SIZE_MB * 1024 * 1024,
    maxFilesPerRequest: validatedEnvironment.STORAGE_MAX_FILES_PER_REQUEST,
  }),
})
