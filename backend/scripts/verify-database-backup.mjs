import 'dotenv/config'
import { spawn } from 'node:child_process'
import { readdir } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const { Client } = pg
const backendRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const backupDirectory =
  process.env.DATABASE_BACKUP_DIR ?? join(backendRoot, '.local', 'backups')
const requestedBackup = process.argv[2]
const expectedDatabase = process.env.DATABASE_BACKUP_NAME ?? 'cablix_erp'
const pgRestoreBinary = process.env.PG_RESTORE_BIN ?? 'pg_restore'
const adminConnectionString =
  process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL

if (!adminConnectionString)
  throw new Error('MIGRATION_DATABASE_URL or DATABASE_URL is required')
const sourceUrl = new URL(adminConnectionString)
if (
  decodeURIComponent(sourceUrl.pathname.replace(/^\//, '')) !== expectedDatabase
)
  throw new Error(`Restore verification is locked to ${expectedDatabase}`)

const backups = (await readdir(backupDirectory))
  .filter(
    (name) => name.startsWith(`${expectedDatabase}_`) && name.endsWith('.dump'),
  )
  .sort()
const backupPath =
  requestedBackup ?? join(backupDirectory, backups.at(-1) ?? '')
if (!backupPath || !basename(backupPath).endsWith('.dump'))
  throw new Error('A PostgreSQL custom-format backup is required')

const verificationDatabase = `cablix_restore_verify_${process.pid}`
const maintenanceUrl = new URL(sourceUrl)
maintenanceUrl.pathname = '/postgres'
maintenanceUrl.searchParams.delete('schema')
const restoreUrl = new URL(sourceUrl)
restoreUrl.pathname = `/${verificationDatabase}`
restoreUrl.searchParams.delete('schema')

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ['ignore', 'ignore', 'pipe'],
    })
    let stderr = ''
    child.stderr.on('data', (chunk) => {
      stderr = `${stderr}${chunk}`.slice(-4000)
    })
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) resolve()
      else
        reject(
          new Error(
            `${command} failed with exit code ${code}${stderr ? `: ${stderr.trim()}` : ''}`,
          ),
        )
    })
  })
}

const maintenance = new Client({ connectionString: maintenanceUrl.toString() })
await maintenance.connect()
let verification
try {
  await maintenance.query(`CREATE DATABASE ${verificationDatabase}`)
  await run(pgRestoreBinary, [
    '--dbname',
    restoreUrl.toString(),
    '--no-owner',
    '--no-privileges',
    backupPath,
  ])
  verification = new Client({ connectionString: restoreUrl.toString() })
  await verification.connect()
  const counts = await verification.query(`
    SELECT
      (SELECT COUNT(*)::integer FROM tenants) AS tenants,
      (SELECT COUNT(*)::integer FROM customers) AS customers,
      (SELECT COUNT(*)::integer FROM customer_contacts) AS customer_contacts,
      (SELECT COUNT(*)::integer FROM customer_travellers) AS customer_travellers,
      (SELECT COUNT(*)::integer FROM _prisma_migrations WHERE finished_at IS NOT NULL) AS migrations
  `)
  console.log(
    JSON.stringify({
      success: true,
      backup: backupPath,
      restoredIntoTemporaryDatabase: verificationDatabase,
      counts: counts.rows[0],
    }),
  )
} finally {
  await verification?.end().catch(() => undefined)
  await maintenance.query(
    'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1',
    [verificationDatabase],
  )
  await maintenance.query(`DROP DATABASE IF EXISTS ${verificationDatabase}`)
  await maintenance.end()
}
