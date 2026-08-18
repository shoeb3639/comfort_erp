import { Router } from 'express'
import { authenticationRateLimiter } from '../../middlewares/rate-limit.middleware'
import { validateBody } from '../../middlewares/validate-request.middleware'
import * as authController from './auth.controller'
import { loginSchema, refreshTokenSchema } from './auth.schema'

export const authRouter = Router()

authRouter.use(authenticationRateLimiter)
authRouter.post('/login', validateBody(loginSchema), authController.login)
authRouter.post(
  '/refresh-token',
  validateBody(refreshTokenSchema),
  authController.refresh,
)
authRouter.post(
  '/logout',
  validateBody(refreshTokenSchema),
  authController.logout,
)
