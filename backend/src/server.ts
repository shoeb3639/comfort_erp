import { app } from './app'
import { env } from './config/env'
import { logger } from './config/logger'
import { disconnectPrisma } from './config/prisma'

const server = app.listen(env.port, () => {
  logger.info(`Cablix backend listening on port ${env.port}`)
})

function shutdown(signal: string): void {
  logger.info(`${signal} received; shutting down`)
  server.close(async (error) => {
    if (error) {
      logger.error('Failed to close HTTP server', { error })
      process.exitCode = 1
    }

    await disconnectPrisma()
  })
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
