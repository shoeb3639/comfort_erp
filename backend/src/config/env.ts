import 'dotenv/config'
import Joi from 'joi'

interface EnvironmentVariables {
  NODE_ENV: 'development' | 'test' | 'production'
  PORT: number
  CORS_ORIGIN: string
  LOG_LEVEL: string
  DATABASE_URL: string
  JWT_ACCESS_SECRET: string
  JWT_REFRESH_SECRET: string
  ACCESS_TOKEN_TTL: number
  REFRESH_TOKEN_TTL: number
  JWT_ISSUER: string
  JWT_AUDIENCE: string
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
  DATABASE_URL: Joi.string()
    .uri({ scheme: ['postgresql', 'postgres'] })
    .required(),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  ACCESS_TOKEN_TTL: Joi.number().integer().positive().default(900),
  REFRESH_TOKEN_TTL: Joi.number().integer().positive().default(604800),
  JWT_ISSUER: Joi.string().default('cablix-api'),
  JWT_AUDIENCE: Joi.string().default('cablix-app'),
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
  databaseUrl: string
  jwtAccessSecret: string
  jwtRefreshSecret: string
  accessTokenTtlSeconds: number
  refreshTokenTtlSeconds: number
  jwtIssuer: string
  jwtAudience: string
}

export const env: Environment = Object.freeze({
  nodeEnv: validatedEnvironment.NODE_ENV,
  port: validatedEnvironment.PORT,
  corsOrigin: validatedEnvironment.CORS_ORIGIN,
  logLevel: validatedEnvironment.LOG_LEVEL,
  databaseUrl: validatedEnvironment.DATABASE_URL,
  jwtAccessSecret: validatedEnvironment.JWT_ACCESS_SECRET,
  jwtRefreshSecret: validatedEnvironment.JWT_REFRESH_SECRET,
  accessTokenTtlSeconds: validatedEnvironment.ACCESS_TOKEN_TTL,
  refreshTokenTtlSeconds: validatedEnvironment.REFRESH_TOKEN_TTL,
  jwtIssuer: validatedEnvironment.JWT_ISSUER,
  jwtAudience: validatedEnvironment.JWT_AUDIENCE,
})
