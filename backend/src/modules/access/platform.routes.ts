import { Router } from 'express'
import Joi from 'joi'
import { authenticateUser } from '../../middlewares/authenticate-user.middleware'
import { authorizePermission } from '../../middlewares/authorize-permission.middleware'
import { checkPlatformUser } from '../../middlewares/check-platform-user.middleware'
import { getPlatformContext } from './access.controller'
import {
  validateBody,
  validateParams,
  validateQuery,
} from '../../middlewares/validate-request.middleware'
import * as platformController from '../platform/platform.controller'
import {
  createOwnerSchema,
  createPlanSchema,
  createSubscriptionSchema,
  planParamsSchema,
  subscriptionParamsSchema,
  tenantParamsSchema,
  tenantStatusSchema,
  updateOwnerSchema,
  updatePlanSchema,
  updateSubscriptionSchema,
  updateTenantSchema,
  platformListQuerySchema,
} from '../platform/platform.schemas'
import {
  getTenantDetail,
  listTenants,
  registerTenant,
} from '../tenants/tenant-registration.controller'
import { registerTenantSchema } from '../tenants/tenant-registration.schema'

export const platformRouter = Router()

platformRouter.get(
  '/me',
  authenticateUser,
  checkPlatformUser,
  authorizePermission('platform.dashboard.view'),
  getPlatformContext,
)

platformRouter.get(
  '/tenants',
  authenticateUser,
  checkPlatformUser,
  authorizePermission('tenant.view'),
  validateQuery(platformListQuerySchema),
  listTenants,
)

platformRouter.get(
  '/tenants/:tenantId',
  authenticateUser,
  checkPlatformUser,
  authorizePermission('tenant.view'),
  validateParams(tenantParamsSchema),
  getTenantDetail,
)
platformRouter.patch(
  '/tenants/:tenantId',
  authenticateUser,
  checkPlatformUser,
  authorizePermission('tenant.update'),
  validateParams(tenantParamsSchema),
  validateBody(updateTenantSchema),
  platformController.updateTenant,
)

platformRouter.get(
  '/subscription-plans',
  authenticateUser,
  checkPlatformUser,
  authorizePermission('subscription.manage'),
  platformController.listPlans,
)

platformRouter.post(
  '/subscription-plans',
  authenticateUser,
  checkPlatformUser,
  authorizePermission('subscription.manage'),
  validateBody(createPlanSchema),
  platformController.createPlan,
)
platformRouter.patch(
  '/tenants/:tenantId/owners/:ownerId',
  authenticateUser,
  checkPlatformUser,
  authorizePermission('tenant.update'),
  validateParams(
    tenantParamsSchema.keys({ ownerId: Joi.string().uuid().required() }),
  ),
  validateBody(updateOwnerSchema),
  platformController.updateOwner,
)
platformRouter.get(
  '/audit-logs',
  authenticateUser,
  checkPlatformUser,
  authorizePermission('platform.dashboard.view'),
  validateQuery(platformListQuerySchema),
  platformController.listAuditLogs,
)
platformRouter.get(
  '/users',
  authenticateUser,
  checkPlatformUser,
  authorizePermission('platform.dashboard.view'),
  validateQuery(platformListQuerySchema),
  platformController.listPlatformUsers,
)
platformRouter.get(
  '/subscription-payments',
  authenticateUser,
  checkPlatformUser,
  authorizePermission('subscription.manage'),
  validateQuery(platformListQuerySchema),
  platformController.listSubscriptionPayments,
)
platformRouter.patch(
  '/subscription-plans/:planId',
  authenticateUser,
  checkPlatformUser,
  authorizePermission('subscription.manage'),
  validateParams(planParamsSchema),
  validateBody(updatePlanSchema),
  platformController.updatePlan,
)
platformRouter.delete(
  '/subscription-plans/:planId',
  authenticateUser,
  checkPlatformUser,
  authorizePermission('subscription.manage'),
  validateParams(planParamsSchema),
  platformController.deactivatePlan,
)

platformRouter.get(
  '/tenant-subscriptions',
  authenticateUser,
  checkPlatformUser,
  authorizePermission('subscription.manage'),
  validateQuery(platformListQuerySchema),
  platformController.listSubscriptions,
)
platformRouter.post(
  '/tenant-subscriptions',
  authenticateUser,
  checkPlatformUser,
  authorizePermission('subscription.manage'),
  validateBody(createSubscriptionSchema),
  platformController.createSubscription,
)
platformRouter.patch(
  '/tenant-subscriptions/:subscriptionId',
  authenticateUser,
  checkPlatformUser,
  authorizePermission('subscription.manage'),
  validateParams(subscriptionParamsSchema),
  validateBody(updateSubscriptionSchema),
  platformController.updateSubscription,
)

platformRouter.post(
  '/tenants/:tenantId/owners',
  authenticateUser,
  checkPlatformUser,
  authorizePermission('tenant.update'),
  validateParams(tenantParamsSchema),
  validateBody(createOwnerSchema),
  platformController.createOwner,
)
platformRouter.patch(
  '/tenants/:tenantId/status',
  authenticateUser,
  checkPlatformUser,
  validateParams(tenantParamsSchema),
  validateBody(tenantStatusSchema),
  platformController.updateTenantStatus,
)

/**
 * @openapi
 * /platform/tenants:
 *   post:
 *     summary: Register a tenant with its owner and subscription
 *     tags: [Platform Tenants]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Tenant registered successfully
 *       400:
 *         description: Invalid registration data
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Platform tenant.create permission required
 *       409:
 *         description: Duplicate tenant or inactive subscription plan
 */
platformRouter.post(
  '/tenants',
  authenticateUser,
  checkPlatformUser,
  authorizePermission('tenant.create'),
  validateBody(registerTenantSchema),
  registerTenant,
)
