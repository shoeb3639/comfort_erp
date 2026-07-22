import { Router } from 'express'
import { healthRouter } from '../modules/health/health.routes'
import { authRouter } from '../modules/auth/auth.routes'
import { platformRouter } from '../modules/access/platform.routes'
import { tenantRouter } from '../modules/access/tenant.routes'

export const apiRouter = Router()

apiRouter.use('/public/health', healthRouter)
apiRouter.use('/auth', authRouter)
apiRouter.use('/platform', platformRouter)
apiRouter.use('/tenant', tenantRouter)
