import { Router } from 'express'
import { authenticateUser } from '../../middlewares/authenticate-user.middleware'
import { authorizePermission } from '../../middlewares/authorize-permission.middleware'
import { checkSubscription } from '../../middlewares/check-subscription.middleware'
import { checkTenantStatus } from '../../middlewares/check-tenant-status.middleware'
import { resolveTenant } from '../../middlewares/resolve-tenant.middleware'
import { getTenantContext } from './access.controller'

export const tenantRouter = Router()

tenantRouter.get(
  '/me',
  authenticateUser,
  resolveTenant,
  checkTenantStatus,
  checkSubscription({ allowRestrictedRead: true }),
  authorizePermission('user.profile.view'),
  getTenantContext,
)
