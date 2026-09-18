import { spawn } from 'node:child_process'
import { loadDatabaseOperationsEnvironment } from './database-operations-environment.mjs'

if (process.env.DATABASE_OPERATIONS_ENV)
  loadDatabaseOperationsEnvironment({ override: true })

const child = spawn(process.execPath, ['--import', 'tsx', 'prisma/seed.ts'], {
  env: process.env,
  stdio: 'inherit',
})

child.on('error', (error) => {
  console.error(error)
  process.exitCode = 1
})

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`Database seed stopped by ${signal}`)
    process.exitCode = 1
    return
  }
  process.exitCode = code ?? 1
})
