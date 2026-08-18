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
import * as controller from './customer.controller'
import {
  createCustomerSchema,
  createTravellerSchema,
  customerListQuerySchema,
  customerParamsSchema,
  updateCustomerSchema,
  updateTravellerSchema,
  travellerParamsSchema,
} from './customer.schema'

export const customerRouter = Router()

customerRouter.use(
  authenticateUser,
  resolveTenant,
  checkTenantStatus,
  checkSubscription(),
)

customerRouter.get(
  '/',
  authorizePermission('customer.view'),
  validateQuery(customerListQuerySchema),
  controller.listCustomers,
)
customerRouter.post(
  '/',
  authorizePermission('customer.create'),
  validateBody(createCustomerSchema),
  controller.createCustomer,
)
customerRouter.get(
  '/:customerId',
  authorizePermission('customer.view'),
  validateParams(customerParamsSchema),
  controller.getCustomer,
)
customerRouter.patch(
  '/:customerId',
  authorizePermission('customer.update'),
  validateParams(customerParamsSchema),
  validateBody(updateCustomerSchema),
  controller.updateCustomer,
)
customerRouter.post(
  '/:customerId/travellers',
  authorizePermission('customer.update'),
  validateParams(customerParamsSchema),
  validateBody(createTravellerSchema),
  controller.createTraveller,
)
customerRouter.get(
  '/:customerId/travellers/:travellerId',
  authorizePermission('customer.view'),
  validateParams(travellerParamsSchema),
  controller.getTraveller,
)
customerRouter.patch(
  '/:customerId/travellers/:travellerId',
  authorizePermission('customer.update'),
  validateParams(travellerParamsSchema),
  validateBody(updateTravellerSchema),
  controller.updateTraveller,
)
