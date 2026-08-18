import 'dotenv/config'
import { randomBytes } from 'node:crypto'
import { readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const { Client } = pg
const backendRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const envPath = join(backendRoot, '.env')
const expectedDatabase = 'cablix_erp'
const runtimeRole = 'cablix_app'
const adminConnectionString =
  process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL

if (!adminConnectionString)
  throw new Error('DATABASE_URL or MIGRATION_DATABASE_URL is required')
const adminUrl = new URL(adminConnectionString)
const databaseName = decodeURIComponent(adminUrl.pathname.replace(/^\//, ''))
if (databaseName !== expectedDatabase)
  throw new Error(
    `Role provisioning is locked to ${expectedDatabase}; received ${databaseName}`,
  )
if (adminUrl.username === runtimeRole) {
  throw new Error(
    'MIGRATION_DATABASE_URL must use the administrative database role',
  )
}

const password = randomBytes(32).toString('base64url')
const client = new Client({ connectionString: adminConnectionString })
await client.connect()
try {
  const administrator = await client.query(
    'SELECT current_user AS name, rolsuper FROM pg_roles WHERE rolname = current_user',
  )
  if (!administrator.rows[0]?.rolsuper)
    throw new Error('Administrative connection must use a PostgreSQL superuser')

  const roleExists = await client.query(
    'SELECT 1 FROM pg_roles WHERE rolname = $1',
    [runtimeRole],
  )
  const formattedRoleStatement = await client.query(
    roleExists.rowCount
      ? "SELECT format('ALTER ROLE cablix_app WITH LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS', $1::text) AS sql"
      : "SELECT format('CREATE ROLE cablix_app WITH LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS', $1::text) AS sql",
    [password],
  )
  await client.query('BEGIN')
  await client.query(formattedRoleStatement.rows[0].sql)
  await client.query('REVOKE CREATE ON SCHEMA public FROM PUBLIC')
  await client.query('REVOKE ALL ON DATABASE cablix_erp FROM cablix_app')
  await client.query('GRANT CONNECT ON DATABASE cablix_erp TO cablix_app')
  await client.query('GRANT USAGE ON SCHEMA public TO cablix_app')
  await client.query(
    'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO cablix_app',
  )
  await client.query(
    'GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO cablix_app',
  )
  await client.query(
    'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO cablix_app',
  )
  await client.query(
    'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO cablix_app',
  )
  await client.query(
    'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO cablix_app',
  )
  await client.query(
    'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO cablix_app',
  )
  await client.query('COMMIT')
} catch (error) {
  await client.query('ROLLBACK').catch(() => undefined)
  throw error
} finally {
  await client.end()
}

const runtimeUrl = new URL(adminUrl)
runtimeUrl.username = runtimeRole
runtimeUrl.password = password
const testUrl = new URL(adminUrl)
testUrl.pathname = '/cablix_erp_test'

const originalEnv = await readFile(envPath, 'utf8')
const replaceOrAppend = (contents, name, value) => {
  const line = `${name}=${value}`
  const pattern = new RegExp(`^${name}=.*$`, 'm')
  return pattern.test(contents)
    ? contents.replace(pattern, line)
    : `${contents.trimEnd()}\n${line}\n`
}
let updatedEnv = replaceOrAppend(
  originalEnv,
  'MIGRATION_DATABASE_URL',
  adminUrl.toString(),
)
updatedEnv = replaceOrAppend(updatedEnv, 'DATABASE_URL', runtimeUrl.toString())
updatedEnv = replaceOrAppend(
  updatedEnv,
  'TEST_DATABASE_URL',
  testUrl.toString(),
)
const temporaryEnvPath = `${envPath}.runtime-role-${process.pid}`
await writeFile(temporaryEnvPath, updatedEnv, { mode: 0o600 })
await rename(temporaryEnvPath, envPath)

console.log(
  JSON.stringify({
    success: true,
    database: expectedDatabase,
    runtimeRole,
    administrativeRole: adminUrl.username,
    environmentUpdated: true,
  }),
)
