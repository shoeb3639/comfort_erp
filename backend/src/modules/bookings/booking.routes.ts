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
import * as controller from './booking.controller'
import {
  assignmentSchema,
  bookingCollectionParamsSchema,
  bookingParamsSchema,
  bookingQuerySchema,
  cancellationSchema,
  closeBookingSchema,
  collectionSchema,
  collectionVerificationSchema,
  createBookingSchema,
  dutyCompleteSchema,
  dutyStartSchema,
  updateBookingSchema,
} from './booking.schema'

export const bookingRouter = Router()
bookingRouter.use(
  authenticateUser,
  resolveTenant,
  checkTenantStatus,
  checkSubscription(),
)
bookingRouter.get(
  '/',
  authorizePermission('booking.view'),
  validateQuery(bookingQuerySchema),
  controller.list,
)
bookingRouter.post(
  '/',
  authorizePermission('booking.create'),
  validateBody(createBookingSchema),
  controller.create,
)
bookingRouter.get(
  '/:bookingId',
  authorizePermission('booking.view'),
  validateParams(bookingParamsSchema),
  controller.get,
)
bookingRouter.patch(
  '/:bookingId',
  authorizePermission('booking.create'),
  validateParams(bookingParamsSchema),
  validateBody(updateBookingSchema),
  controller.update,
)
bookingRouter.patch(
  '/:bookingId/assignment',
  authorizePermission('booking.assign'),
  validateParams(bookingParamsSchema),
  validateBody(assignmentSchema),
  controller.assign,
)
bookingRouter.patch(
  '/:bookingId/confirm',
  authorizePermission('booking.create'),
  validateParams(bookingParamsSchema),
  controller.confirm,
)
bookingRouter.patch(
  '/:bookingId/duty/start',
  authorizePermission('booking.assign'),
  validateParams(bookingParamsSchema),
  validateBody(dutyStartSchema),
  controller.startDuty,
)
bookingRouter.patch(
  '/:bookingId/duty/complete',
  authorizePermission('booking.assign'),
  validateParams(bookingParamsSchema),
  validateBody(dutyCompleteSchema),
  controller.completeDuty,
)
bookingRouter.patch(
  '/:bookingId/cancel',
  authorizePermission('booking.create'),
  validateParams(bookingParamsSchema),
  validateBody(cancellationSchema),
  controller.cancel,
)
bookingRouter.post(
  '/:bookingId/close',
  authorizePermission('booking.close'),
  validateParams(bookingParamsSchema),
  validateBody(closeBookingSchema),
  controller.close,
)
bookingRouter.get(
  '/:bookingId/profit',
  authorizePermission('booking.view'),
  validateParams(bookingParamsSchema),
  controller.profit,
)
bookingRouter.post(
  '/:bookingId/collections',
  authorizePermission('collection.create'),
  validateParams(bookingParamsSchema),
  validateBody(collectionSchema),
  controller.addCollection,
)
bookingRouter.patch(
  '/:bookingId/collections/:collectionId/verify',
  authorizePermission('accounts.deposit.manage'),
  validateParams(bookingCollectionParamsSchema),
  validateBody(collectionVerificationSchema),
  controller.verifyCollection,
)
bookingRouter.delete(
  '/:bookingId/collections/:collectionId',
  authorizePermission('collection.create'),
  validateParams(bookingCollectionParamsSchema),
  controller.voidCollection,
)
bookingRouter.delete(
  '/:bookingId',
  authorizePermission('booking.create'),
  validateParams(bookingParamsSchema),
  controller.remove,
)
