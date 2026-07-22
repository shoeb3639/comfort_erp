import { Router } from 'express'
import { authenticateUser } from '../../middlewares/authenticate-user.middleware'
import { authorizePermission } from '../../middlewares/authorize-permission.middleware'
import { checkPlatformUser } from '../../middlewares/check-platform-user.middleware'
import { getPlatformContext } from './access.controller'

export const platformRouter = Router()

platformRouter.get(
  '/me',
  authenticateUser,
  checkPlatformUser,
  authorizePermission('platform.dashboard.view'),
  getPlatformContext,
)
