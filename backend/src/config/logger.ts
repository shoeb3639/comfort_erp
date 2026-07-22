import winston from 'winston'
import { env } from './env'

const formats = [
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
]

if (env.nodeEnv === 'production') {
  formats.push(winston.format.json())
} else {
  formats.push(
    winston.format.combine(winston.format.colorize(), winston.format.simple()),
  )
}

export const logger = winston.createLogger({
  level: env.logLevel,
  format: winston.format.combine(...formats),
  silent: env.nodeEnv === 'test',
  transports: [new winston.transports.Console()],
})
