import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import swaggerUi from 'swagger-ui-express'
import { env } from './config/env'
import { swaggerSpecification } from './docs/swagger'
import {
  errorHandler,
  notFoundHandler,
} from './middlewares/error-handler.middleware'
import { apiRouter } from './routes'

export const app = express()

app.disable('x-powered-by')
app.use(helmet())
app.use(cors({ origin: env.corsOrigin, credentials: true }))
app.use(express.json({ limit: '1mb' }))
app.use(express.urlencoded({ extended: true, limit: '1mb' }))

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecification))
app.use('/api/v1', apiRouter)

app.use(notFoundHandler)
app.use(errorHandler)
