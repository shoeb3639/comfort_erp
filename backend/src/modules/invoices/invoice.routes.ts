import { Router } from 'express'
import Joi from 'joi'
import { authenticateUser } from '../../middlewares/authenticate-user.middleware'
import { authorizePermission } from '../../middlewares/authorize-permission.middleware'
import { checkSubscription } from '../../middlewares/check-subscription.middleware'
import { checkTenantStatus } from '../../middlewares/check-tenant-status.middleware'
import { resolveTenant } from '../../middlewares/resolve-tenant.middleware'
import {
  validateParams,
  validateQuery,
} from '../../middlewares/validate-request.middleware'
import * as controller from './invoice.controller'

const params = Joi.object({ invoiceId: Joi.string().uuid().required() })
const query = Joi.object({
  search: Joi.string().trim().max(200).empty(''),
  status: Joi.string().valid('DRAFT', 'GENERATED', 'CANCELLED'),
})

export const invoiceRouter = Router()
invoiceRouter.use(
  authenticateUser,
  resolveTenant,
  checkTenantStatus,
  checkSubscription(),
)
invoiceRouter.get(
  '/',
  authorizePermission('invoice.view'),
  validateQuery(query),
  controller.list,
)
invoiceRouter.get(
  '/:invoiceId',
  authorizePermission('invoice.view'),
  validateParams(params),
  controller.get,
)
invoiceRouter.patch(
  '/:invoiceId/generate',
  authorizePermission('invoice.generate'),
  validateParams(params),
  controller.generate,
)
