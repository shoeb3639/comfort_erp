import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'
import { env } from './env'

const adapter = new PrismaPg({ connectionString: env.databaseUrl })

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
