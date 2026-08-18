/* global __dirname */

const path = require('node:path')
const { statSync } = require('node:fs')
const { config } = require('dotenv')

const operationsEnvironmentPath =
  process.env.DATABASE_OPERATIONS_ENV ??
  path.join(__dirname, '.local', 'secrets', 'database-operations.env')
const operationsEnvironment = statSync(operationsEnvironmentPath)
if ((operationsEnvironment.mode & 0o077) !== 0) {
  throw new Error(
    `Database operations environment must have 0600 permissions: ${operationsEnvironmentPath}`,
  )
}
config({ path: operationsEnvironmentPath, quiet: true })
config({ path: path.join(__dirname, '.env'), quiet: true })

process.env.NODE_ENV = 'test'
const testDatabaseUrl = process.env.TEST_DATABASE_URL
if (!testDatabaseUrl) {
  throw new Error(
    'TEST_DATABASE_URL is required in the database operations environment',
  )
}
const testDatabaseName = decodeURIComponent(
  new URL(testDatabaseUrl).pathname.replace(/^\//, ''),
)
if (testDatabaseName !== 'cablix_erp_test') {
  throw new Error(
    `Tests are locked to cablix_erp_test; received ${testDatabaseName || 'an empty database name'}`,
  )
}
// Always override DATABASE_URL so an exported development/production URL can
// never make integration-test cleanup target the live Cablix database.
process.env.DATABASE_URL = testDatabaseUrl
process.env.JWT_ACCESS_SECRET ??=
  'test-access-secret-that-is-at-least-thirty-two-characters'
process.env.JWT_REFRESH_SECRET ??=
  'test-refresh-secret-that-is-at-least-thirty-two-characters'
process.env.ACCESS_TOKEN_TTL ??= '900'
process.env.REFRESH_TOKEN_TTL ??= '604800'
process.env.JWT_ISSUER ??= 'cablix-api-test'
process.env.JWT_AUDIENCE ??= 'cablix-app-test'
