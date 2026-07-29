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
import * as controller from './vendor.controller'
import {
  childParamsSchema,
  driverSchema,
  updateDriverSchema,
  updateVehicleSchema,
  updateVendorSchema,
  vehicleSchema,
  vendorParamsSchema,
  vendorQuerySchema,
  vendorSchema,
} from './vendor.schemas'

export const vendorRouter = Router()
vendorRouter.use(
  authenticateUser,
  resolveTenant,
  checkTenantStatus,
  checkSubscription(),
)
vendorRouter.get(
  '/',
  authorizePermission('vendor.view'),
  validateQuery(vendorQuerySchema),
  controller.list,
)
vendorRouter.post(
  '/',
  authorizePermission('vendor.create'),
  validateBody(vendorSchema),
  controller.create,
)
vendorRouter.get(
  '/:vendorId',
  authorizePermission('vendor.view'),
  validateParams(vendorParamsSchema),
  controller.get,
)
vendorRouter.patch(
  '/:vendorId',
  authorizePermission('vendor.update'),
  validateParams(vendorParamsSchema),
  validateBody(updateVendorSchema),
  controller.update,
)
vendorRouter.delete(
  '/:vendorId',
  authorizePermission('vendor.delete'),
  validateParams(vendorParamsSchema),
  controller.remove,
)
vendorRouter.post(
  '/:vendorId/vehicles',
  authorizePermission('vendor.create'),
  validateParams(vendorParamsSchema),
  validateBody(vehicleSchema),
  controller.createVehicle,
)
vendorRouter.patch(
  '/:vendorId/vehicles/:childId',
  authorizePermission('vendor.update'),
  validateParams(childParamsSchema),
  validateBody(updateVehicleSchema),
  controller.updateVehicle,
)
vendorRouter.delete(
  '/:vendorId/vehicles/:childId',
  authorizePermission('vendor.delete'),
  validateParams(childParamsSchema),
  controller.deleteVehicle,
)
vendorRouter.post(
  '/:vendorId/drivers',
  authorizePermission('vendor.create'),
  validateParams(vendorParamsSchema),
  validateBody(driverSchema),
  controller.createDriver,
)
vendorRouter.patch(
  '/:vendorId/drivers/:childId',
  authorizePermission('vendor.update'),
  validateParams(childParamsSchema),
  validateBody(updateDriverSchema),
  controller.updateDriver,
)
vendorRouter.delete(
  '/:vendorId/drivers/:childId',
  authorizePermission('vendor.delete'),
  validateParams(childParamsSchema),
  controller.deleteDriver,
)
