import { Router } from 'express'
import { authenticateUser } from '../../middlewares/authenticate-user.middleware'
import { authorizePermission } from '../../middlewares/authorize-permission.middleware'
import { checkSubscription } from '../../middlewares/check-subscription.middleware'
import { checkTenantStatus } from '../../middlewares/check-tenant-status.middleware'
import { resolveTenant } from '../../middlewares/resolve-tenant.middleware'
import { getTenantContext } from '../access/access.controller'
import { companySetupRouter } from '../company-setup/company-setup.routes'
import { customerRouter } from '../customers/customer.routes'
import { vendorRouter } from '../vendors/vendor.routes'
import { vehicleRouter } from '../vehicles/vehicle.routes'
import { driverRouter } from '../drivers/driver.routes'
import { bookingRouter } from '../bookings/booking.routes'
import { invoiceRouter } from '../invoices/invoice.routes'
import { accountsRouter } from '../accounts/accounts.routes'
import { reportRouter } from '../reports/report.routes'

export const tenantRouter = Router()

tenantRouter.get(
  '/me',
  authenticateUser,
  resolveTenant,
  checkTenantStatus,
  checkSubscription({ allowRestrictedRead: true }),
  authorizePermission('user.profile.view'),
  getTenantContext,
)

tenantRouter.use('/setup', companySetupRouter)
tenantRouter.use('/customers', customerRouter)
tenantRouter.use('/vendors', vendorRouter)
tenantRouter.use('/vehicles', vehicleRouter)
tenantRouter.use('/drivers', driverRouter)
tenantRouter.use('/bookings', bookingRouter)
tenantRouter.use('/invoices', invoiceRouter)
tenantRouter.use('/accounts', accountsRouter)
tenantRouter.use('/reports', reportRouter)

tenantRouter.get(
  '/access',
  authenticateUser,
  resolveTenant,
  checkTenantStatus,
  checkSubscription(),
  authorizePermission('user.profile.view'),
  getTenantContext,
)
