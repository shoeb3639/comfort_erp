import { statSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'

const backendRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const defaultEnvironmentPath = join(
  backendRoot,
  '.local',
  'secrets',
  'database-operations.env',
)

export function databaseOperationsEnvironmentPath() {
  const configuredPath = process.env.DATABASE_OPERATIONS_ENV
  if (!configuredPath) return defaultEnvironmentPath
  return isAbsolute(configuredPath)
    ? configuredPath
    : resolve(backendRoot, configuredPath)
}

export function loadDatabaseOperationsEnvironment() {
  const environmentPath = databaseOperationsEnvironmentPath()
  let file
  try {
    file = statSync(environmentPath)
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error(
        `Database operations environment not found at ${environmentPath}`,
      )
    }
    throw error
  }

  if (!file.isFile())
    throw new Error(
      `Database operations environment is not a file: ${environmentPath}`,
    )
  if ((file.mode & 0o077) !== 0)
    throw new Error(
      `Database operations environment must have 0600 permissions: ${environmentPath}`,
    )

  const result = config({ path: environmentPath, quiet: true })
  if (result.error) throw result.error
  return environmentPath
}
