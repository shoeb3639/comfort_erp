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
import * as controller from './vehicle.controller'
import {
  updateVehicleSchema,
  vehicleParamsSchema,
  vehicleQuerySchema,
  vehicleSchema,
  vehicleTypeSchema,
} from './vehicle.schema'

export const vehicleRouter = Router()
vehicleRouter.use(
  authenticateUser,
  resolveTenant,
  checkTenantStatus,
  checkSubscription(),
)
vehicleRouter.get(
  '/types',
  authorizePermission('vehicle.view'),
  controller.types,
)
vehicleRouter.post(
  '/types',
  authorizePermission('vehicle.manage'),
  validateBody(vehicleTypeSchema),
  controller.createType,
)
vehicleRouter.get(
  '/',
  authorizePermission('vehicle.view'),
  validateQuery(vehicleQuerySchema),
  controller.list,
)
vehicleRouter.post(
  '/',
  authorizePermission('vehicle.manage'),
  validateBody(vehicleSchema),
  controller.create,
)
vehicleRouter.get(
  '/:vehicleId',
  authorizePermission('vehicle.view'),
  validateParams(vehicleParamsSchema),
  controller.get,
)
vehicleRouter.patch(
  '/:vehicleId',
  authorizePermission('vehicle.manage'),
  validateParams(vehicleParamsSchema),
  validateBody(updateVehicleSchema),
  controller.update,
)
vehicleRouter.delete(
  '/:vehicleId',
  authorizePermission('vehicle.manage'),
  validateParams(vehicleParamsSchema),
  controller.remove,
)
