import 'dotenv/config'
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import {
  chmod,
  copyFile,
  mkdir,
  readdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const backendRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const backupDirectory =
  process.env.DATABASE_BACKUP_DIR ?? join(backendRoot, '.local', 'backups')
const mirrorDirectory = process.env.DATABASE_BACKUP_MIRROR_DIR
const retentionCount = Number(process.env.DATABASE_BACKUP_RETENTION ?? 30)
const expectedDatabase = process.env.DATABASE_BACKUP_NAME ?? 'cablix_erp'
const pgDumpBinary = process.env.PG_DUMP_BIN ?? 'pg_dump'
const pgRestoreBinary = process.env.PG_RESTORE_BIN ?? 'pg_restore'
const connectionString =
  process.env.DATABASE_BACKUP_URL ??
  process.env.MIGRATION_DATABASE_URL ??
  process.env.DATABASE_URL

if (!connectionString) throw new Error('A database backup URL is required')
if (!Number.isInteger(retentionCount) || retentionCount < 7)
  throw new Error('DATABASE_BACKUP_RETENTION must be an integer of at least 7')

const databaseUrl = new URL(connectionString)
const databaseName = decodeURIComponent(databaseUrl.pathname.replace(/^\//, ''))
if (databaseName !== expectedDatabase)
  throw new Error(
    `Backup is locked to ${expectedDatabase}; received ${databaseName || 'an empty database name'}`,
  )
databaseUrl.searchParams.delete('schema')

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

async function prune(directory) {
  const prefix = `${expectedDatabase}_`
  const backups = (await readdir(directory, { withFileTypes: true }))
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.startsWith(prefix) &&
        entry.name.endsWith('.dump'),
    )
    .map((entry) => entry.name)
    .sort()
    .reverse()
  for (const name of backups.slice(retentionCount)) {
    await rm(join(directory, name))
    await rm(join(directory, `${name}.json`), { force: true })
  }
}

const timestamp = new Date()
  .toISOString()
  .replace(/[:.]/g, '-')
  .replace('Z', 'Z')
const filename = `${expectedDatabase}_${timestamp}.dump`
const finalPath = join(backupDirectory, filename)
const partialPath = join(backupDirectory, `.${filename}.partial-${process.pid}`)

await mkdir(backupDirectory, { recursive: true })
try {
  await run(pgDumpBinary, [
    databaseUrl.toString(),
    '--format=custom',
    '--no-owner',
    '--no-privileges',
    `--file=${partialPath}`,
  ])
  await run(pgRestoreBinary, ['--list', partialPath])
  const contents = await readFile(partialPath)
  const digest = createHash('sha256').update(contents).digest('hex')
  const metadata = {
    database: databaseName,
    createdAt: new Date().toISOString(),
    filename,
    bytes: contents.length,
    sha256: digest,
    format: 'PostgreSQL custom archive',
    verifiedWith: 'pg_restore --list',
  }
  await copyFile(partialPath, finalPath)
  await chmod(finalPath, 0o600)
  await writeFile(
    `${finalPath}.json`,
    `${JSON.stringify(metadata, null, 2)}\n`,
    {
      mode: 0o600,
    },
  )
  await rm(partialPath, { force: true })

  if (mirrorDirectory) {
    await mkdir(mirrorDirectory, { recursive: true })
    await copyFile(finalPath, join(mirrorDirectory, filename))
    await chmod(join(mirrorDirectory, filename), 0o600)
    await copyFile(
      `${finalPath}.json`,
      join(mirrorDirectory, `${filename}.json`),
    )
    await chmod(join(mirrorDirectory, `${filename}.json`), 0o600)
    await prune(mirrorDirectory)
  }
  await prune(backupDirectory)

  const backupStat = await stat(finalPath)
  console.log(
    JSON.stringify({
      success: true,
      database: databaseName,
      backup: finalPath,
      bytes: backupStat.size,
      sha256: digest,
      mirrored: Boolean(mirrorDirectory),
      retentionCount,
    }),
  )
} catch (error) {
  await rm(partialPath, { force: true })
  throw error
}
