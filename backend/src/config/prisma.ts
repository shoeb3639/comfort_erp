import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'
import { env } from './env'

const databaseUrl = new URL(env.databaseUrl)
const adapter = new PrismaPg({
  connectionString: env.databaseUrl,
  // node-postgres accepts an empty password for trusted local connections, but
  // Prisma's adapter otherwise passes null to the SCRAM client and it throws
  // before PostgreSQL can apply pg_hba.conf authentication rules.
  password: databaseUrl.password,
})

export const prisma = new PrismaClient({
  adapter,
  log:
    env.nodeEnv === 'development'
      ? ['warn', 'error']
      : env.nodeEnv === 'production'
        ? ['error']
        : [],
})

export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect()
}
