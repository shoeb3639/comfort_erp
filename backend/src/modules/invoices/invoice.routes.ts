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
import * as controller from './invoice.controller'
import {
  cancelInvoiceSchema,
  invoiceBodySchema,
  invoiceParamsSchema,
  invoiceQuerySchema,
} from './invoice.schema'

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
  validateQuery(invoiceQuerySchema),
  controller.list,
)
invoiceRouter.get(
  '/options',
  authorizePermission('invoice.create'),
  controller.options,
)
invoiceRouter.post(
  '/',
  authorizePermission('invoice.create'),
  validateBody(invoiceBodySchema),
  controller.create,
)
invoiceRouter.get(
  '/:invoiceId',
  authorizePermission('invoice.view'),
  validateParams(invoiceParamsSchema),
  controller.get,
)
invoiceRouter.put(
  '/:invoiceId',
  authorizePermission('invoice.create'),
  validateParams(invoiceParamsSchema),
  validateBody(invoiceBodySchema),
  controller.update,
)
invoiceRouter.patch(
  '/:invoiceId/generate',
  authorizePermission('invoice.generate'),
  validateParams(invoiceParamsSchema),
  controller.generate,
)
invoiceRouter.patch(
  '/:invoiceId/cancel',
  authorizePermission('invoice.generate'),
  validateParams(invoiceParamsSchema),
  validateBody(cancelInvoiceSchema),
  controller.cancel,
)
