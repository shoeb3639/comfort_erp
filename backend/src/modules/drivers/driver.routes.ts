import { Router } from 'express'
import { authenticateUser } from '../../middlewares/authenticate-user.middleware'
import { authorizePermission } from '../../middlewares/authorize-permission.middleware'
import { checkSubscription } from '../../middlewares/check-subscription.middleware'
import { checkTenantStatus } from '../../middlewares/check-tenant-status.middleware'
import { resolveTenant } from '../../middlewares/resolve-tenant.middleware'
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../middlewares/validate-request.middleware'
import * as controller from './driver.controller'
import {
  driverParamsSchema,
  driverQuerySchema,
  driverSchema,
  updateDriverSchema,
} from './driver.schema'
export const driverRouter = Router()
driverRouter.use(
  authenticateUser,
  resolveTenant,
  checkTenantStatus,
  checkSubscription(),
)
driverRouter.get(
  '/',
  authorizePermission('driver.view'),
  validateQuery(driverQuerySchema),
  controller.list,
)
driverRouter.post(
  '/',
  authorizePermission('driver.manage'),
  validateBody(driverSchema),
  controller.create,
)
driverRouter.get(
  '/:driverId/ledger',
  authorizePermission('driver.view'),
  authorizePermission('accounts.ledger.view'),
  validateParams(driverParamsSchema),
  controller.ledger,
)
driverRouter.get(
  '/:driverId',
  authorizePermission('driver.view'),
  validateParams(driverParamsSchema),
  controller.get,
)
driverRouter.patch(
  '/:driverId',
  authorizePermission('driver.manage'),
  validateParams(driverParamsSchema),
  validateBody(updateDriverSchema),
  controller.update,
)
driverRouter.delete(
  '/:driverId',
  authorizePermission('driver.manage'),
  validateParams(driverParamsSchema),
  controller.remove,
)
