import { Router } from 'express'
import { authenticateUser } from '../../middlewares/authenticate-user.middleware'
import { authorizePermission } from '../../middlewares/authorize-permission.middleware'
import { checkSubscription } from '../../middlewares/check-subscription.middleware'
import { checkTenantStatus } from '../../middlewares/check-tenant-status.middleware'
import { resolveTenant } from '../../middlewares/resolve-tenant.middleware'
import { validateQuery } from '../../middlewares/validate-request.middleware'
import * as controller from './city.controller'
import { citySearchQuerySchema, placeSearchQuerySchema } from './city.schema'

export const cityRouter = Router()

cityRouter.use(
  authenticateUser,
  resolveTenant,
  checkTenantStatus,
  checkSubscription(),
)

cityRouter.get(
  '/',
  authorizePermission('booking.view'),
  validateQuery(citySearchQuerySchema),
  controller.searchIndianCities,
)

cityRouter.get(
  '/places',
  authorizePermission('booking.view'),
  validateQuery(placeSearchQuerySchema),
  controller.searchReportingPlaces,
)
