import { chmod, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  databaseOperationsEnvironmentPath,
  loadDatabaseOperationsEnvironment,
} from './database-operations-environment.mjs'

const backendRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const runtimeEnvironmentPath = join(backendRoot, '.env')
const operationsEnvironmentPath = databaseOperationsEnvironmentPath()
const operationalKeys = new Set([
  'DATABASE_BACKUP_URL',
  'MIGRATION_DATABASE_URL',
  'SHADOW_DATABASE_URL',
  'TEST_DATABASE_URL',
])

function parseEnvironment(contents) {
  const values = new Map()
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/)
    if (match) values.set(match[1], match[2])
  }
  return values
}

function withoutOperationalCredentials(contents) {
  return `${contents
    .split(/\r?\n/)
    .filter((line) => {
      const match = line.match(/^([A-Z][A-Z0-9_]*)=/)
      return !match || !operationalKeys.has(match[1])
    })
    .join('\n')
    .trimEnd()}\n`
}

function replaceOrAppend(contents, name, value) {
  const line = `${name}=${value}`
  const pattern = new RegExp(`^${name}=.*$`, 'm')
  return pattern.test(contents)
    ? contents.replace(pattern, line)
    : `${contents.trimEnd()}\n${line}\n`
}

const runtimeContents = await readFile(runtimeEnvironmentPath, 'utf8')
const runtimeValues = parseEnvironment(runtimeContents)
const runtimeDatabaseUrl = runtimeValues.get('DATABASE_URL')
if (!runtimeDatabaseUrl)
  throw new Error('Runtime DATABASE_URL is required before separation')
if (new URL(runtimeDatabaseUrl).username !== 'cablix_app')
  throw new Error(
    'Runtime DATABASE_URL must use the restricted cablix_app role',
  )

let operationsValues = new Map()
let existingOperationsContents = ''
try {
  loadDatabaseOperationsEnvironment()
  existingOperationsContents = await readFile(operationsEnvironmentPath, 'utf8')
  operationsValues = parseEnvironment(existingOperationsContents)
} catch (error) {
  if (
    !String(error?.message).startsWith(
      'Database operations environment not found',
    )
  )
    throw error
}

for (const key of operationalKeys) {
  const legacyValue = runtimeValues.get(key)
  if (legacyValue && !operationsValues.has(key))
    operationsValues.set(key, legacyValue)
}
if (!operationsValues.has('DATABASE_BACKUP_URL')) {
  const migrationUrl = operationsValues.get('MIGRATION_DATABASE_URL')
  if (migrationUrl) operationsValues.set('DATABASE_BACKUP_URL', migrationUrl)
}

for (const requiredKey of [
  'DATABASE_BACKUP_URL',
  'MIGRATION_DATABASE_URL',
  'SHADOW_DATABASE_URL',
  'TEST_DATABASE_URL',
]) {
  if (!operationsValues.get(requiredKey))
    throw new Error(`${requiredKey} is required before separation`)
}

let operationsContents = existingOperationsContents.trim()
  ? existingOperationsContents
  : [
      '# Loaded only by database administration, backup, migration, and test tools.',
      '# Never load this file from the API runtime.',
      '',
    ].join('\n')
for (const key of operationalKeys)
  operationsContents = replaceOrAppend(
    operationsContents,
    key,
    operationsValues.get(key),
  )

await mkdir(dirname(operationsEnvironmentPath), {
  recursive: true,
  mode: 0o700,
})
await chmod(dirname(operationsEnvironmentPath), 0o700)
const operationsTemporaryPath = `${operationsEnvironmentPath}.tmp-${process.pid}`
await writeFile(operationsTemporaryPath, operationsContents, { mode: 0o600 })
await chmod(operationsTemporaryPath, 0o600)
await rename(operationsTemporaryPath, operationsEnvironmentPath)

const runtimeTemporaryPath = `${runtimeEnvironmentPath}.tmp-${process.pid}`
await writeFile(
  runtimeTemporaryPath,
  withoutOperationalCredentials(runtimeContents),
  { mode: 0o600 },
)
await chmod(runtimeTemporaryPath, 0o600)
await rename(runtimeTemporaryPath, runtimeEnvironmentPath)

console.log(
  JSON.stringify({
    success: true,
    runtimeEnvironment: runtimeEnvironmentPath,
    operationsEnvironment: operationsEnvironmentPath,
    movedKeys: Array.from(operationalKeys),
  }),
)
