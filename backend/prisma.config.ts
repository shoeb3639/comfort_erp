import { config } from 'dotenv'
import { defineConfig, env } from 'prisma/config'
import { loadDatabaseOperationsEnvironment } from './scripts/database-operations-environment.mjs'

loadDatabaseOperationsEnvironment()
config({ path: '.env', quiet: true })

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('MIGRATION_DATABASE_URL'),
    shadowDatabaseUrl: env('SHADOW_DATABASE_URL'),
  },
})
