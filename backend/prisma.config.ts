import { config } from 'dotenv'

import { defineConfig, env } from 'prisma/config'

import { loadDatabaseOperationsEnvironment } from './scripts/database-operations-environment.mjs'

// Local database administration/migration commands use the protected
// database-operations environment file.
//
// Vercel/CI builds do not require migration credentials just to run
// `prisma generate`.
if (!process.env.VERCEL) {
  loadDatabaseOperationsEnvironment()
}

config({ path: '.env', quiet: true })

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.MIGRATION_DATABASE_URL ?? env('DATABASE_URL'),
    ...(process.env.SHADOW_DATABASE_URL
      ? { shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL }
      : {}),
  },
})