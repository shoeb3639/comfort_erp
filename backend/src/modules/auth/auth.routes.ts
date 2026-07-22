import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { validateBody } from '../../middlewares/validate-request.middleware'
import * as authController from './auth.controller'
import { loginSchema, refreshTokenSchema } from './auth.schema'

export const authRouter = Router()

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_request, response) => {
    response.status(429).json({
      success: false,
      message: 'Too many authentication attempts',
      code: 'RATE_LIMITED',
      details: [],
    })
  },
})

authRouter.use(authRateLimit)
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
