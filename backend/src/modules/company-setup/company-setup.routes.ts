import { Router } from 'express'
import { authenticateUser } from '../../middlewares/authenticate-user.middleware'
import { authorizePermission } from '../../middlewares/authorize-permission.middleware'
import { checkSubscription } from '../../middlewares/check-subscription.middleware'
import { checkTenantStatus } from '../../middlewares/check-tenant-status.middleware'
import { resolveTenant } from '../../middlewares/resolve-tenant.middleware'
import {
  validateBody,
  validateParams,
} from '../../middlewares/validate-request.middleware'
import * as controller from './company-setup.controller'
import {
  bankAccountSchema,
  companyProfileSchema,
  createRoleSchema,
  createTenantUserSchema,
  gstRegistrationSchema,
  invoiceSettingsSchema,
  locationSchema,
  recordParamsSchema,
  rolePermissionsSchema,
  taxSettingsSchema,
  updateBankAccountSchema,
  updateGstRegistrationSchema,
  updateLocationSchema,
  updateRoleSchema,
  updateTenantUserSchema,
} from './company-setup.schemas'

export const companySetupRouter = Router()

companySetupRouter.use(
  authenticateUser,
  resolveTenant,
  checkTenantStatus,
  checkSubscription(),
)

const settingsPermission = authorizePermission('settings.company.manage')

companySetupRouter.get(
  '/company-profile',
  settingsPermission,
  controller.getCompanyProfile,
)
companySetupRouter.patch(
  '/company-profile',
  settingsPermission,
  validateBody(companyProfileSchema),
  controller.updateCompanyProfile,
)
companySetupRouter.get(
  '/tax-settings',
  settingsPermission,
  controller.getTaxSettings,
)
companySetupRouter.patch(
  '/tax-settings',
  settingsPermission,
  validateBody(taxSettingsSchema),
  controller.updateTaxSettings,
)
companySetupRouter.get(
  '/invoice-settings',
  settingsPermission,
  controller.getInvoiceSettings,
)
companySetupRouter.patch(
  '/invoice-settings',
  settingsPermission,
  validateBody(invoiceSettingsSchema),
  controller.updateInvoiceSettings,
)
companySetupRouter.get(
  '/onboarding',
  settingsPermission,
  controller.getOnboarding,
)

companySetupRouter.get(
  '/locations',
  settingsPermission,
  controller.listLocations,
)
companySetupRouter.post(
  '/locations',
  settingsPermission,
  validateBody(locationSchema),
  controller.createLocation,
)
companySetupRouter.patch(
  '/locations/:recordId',
  settingsPermission,
  validateParams(recordParamsSchema),
  validateBody(updateLocationSchema),
  controller.updateLocation,
)

companySetupRouter.get(
  '/bank-accounts',
  settingsPermission,
  controller.listBankAccounts,
)
companySetupRouter.post(
  '/bank-accounts',
  settingsPermission,
  validateBody(bankAccountSchema),
  controller.createBankAccount,
)
companySetupRouter.patch(
  '/bank-accounts/:recordId',
  settingsPermission,
  validateParams(recordParamsSchema),
  validateBody(updateBankAccountSchema),
  controller.updateBankAccount,
)

companySetupRouter.get(
  '/gst-registrations',
  settingsPermission,
  controller.listGstRegistrations,
)
companySetupRouter.post(
  '/gst-registrations',
  settingsPermission,
  validateBody(gstRegistrationSchema),
  controller.createGstRegistration,
)
companySetupRouter.patch(
  '/gst-registrations/:recordId',
  settingsPermission,
  validateParams(recordParamsSchema),
  validateBody(updateGstRegistrationSchema),
  controller.updateGstRegistration,
)

companySetupRouter.get(
  '/users',
  authorizePermission('user.view'),
  controller.listUsers,
)
companySetupRouter.post(
  '/users',
  authorizePermission('user.manage'),
  validateBody(createTenantUserSchema),
  controller.createUser,
)
companySetupRouter.patch(
  '/users/:recordId',
  authorizePermission('user.manage'),
  validateParams(recordParamsSchema),
  validateBody(updateTenantUserSchema),
  controller.updateUser,
)

companySetupRouter.get(
  '/roles',
  authorizePermission('role.view'),
  controller.listRoles,
)
companySetupRouter.post(
  '/roles',
  authorizePermission('role.manage'),
  validateBody(createRoleSchema),
  controller.createRole,
)
companySetupRouter.patch(
  '/roles/:recordId',
  authorizePermission('role.manage'),
  validateParams(recordParamsSchema),
  validateBody(updateRoleSchema),
  controller.updateRole,
)
companySetupRouter.patch(
  '/roles/:recordId/permissions',
  authorizePermission('role.manage'),
  validateParams(recordParamsSchema),
  validateBody(rolePermissionsSchema),
  controller.replaceRolePermissions,
)
companySetupRouter.get(
  '/permissions',
  authorizePermission('permission.view'),
  controller.listPermissions,
)
