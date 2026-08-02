import { Router } from 'express'
import { authenticateUser } from '../../middlewares/authenticate-user.middleware'
import { authorizePermission } from '../../middlewares/authorize-permission.middleware'
import { checkSubscription } from '../../middlewares/check-subscription.middleware'
import { checkTenantStatus } from '../../middlewares/check-tenant-status.middleware'
import { resolveTenant } from '../../middlewares/resolve-tenant.middleware'
import {
  validateParams,
  validateQuery,
} from '../../middlewares/validate-request.middleware'
import * as controller from './report.controller'
import { reportParamsSchema, reportQuerySchema } from './report.schema'

export const reportRouter = Router()

reportRouter.use(
  authenticateUser,
  resolveTenant,
  checkTenantStatus,
  checkSubscription({ allowRestrictedRead: true }),
  authorizePermission('reports.view'),
)

reportRouter.get('/catalog', controller.catalog)
reportRouter.get('/options', controller.options)
reportRouter.get(
  '/:reportKey',
  validateParams(reportParamsSchema),
  validateQuery(reportQuerySchema),
  controller.generate,
)
