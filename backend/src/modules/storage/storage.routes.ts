import { Router } from 'express'
import multer from 'multer'
import { env } from '../../config/env'
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
import * as controller from './storage.controller'
import {
  fileListSchema,
  fileParamsSchema,
  uploadFieldsSchema,
} from './storage.validator'

const multipart = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.storage.maxFileSizeBytes,
    files: 1,
    fields: 4,
    parts: env.storage.maxFilesPerRequest + 4,
  },
})

export const storageRouter = Router()
storageRouter.use(
  authenticateUser,
  resolveTenant,
  checkTenantStatus,
  checkSubscription(),
)

storageRouter.post(
  '/',
  authorizePermission('files.upload'),
  multipart.single('file'),
  validateBody(uploadFieldsSchema),
  controller.upload,
)
storageRouter.get(
  '/',
  authorizePermission('files.view'),
  validateQuery(fileListSchema),
  controller.list,
)
storageRouter.get('/usage', authorizePermission('files.view'), controller.usage)
storageRouter.get(
  '/:fileId',
  authorizePermission('files.view'),
  validateParams(fileParamsSchema),
  controller.get,
)
storageRouter.get(
  '/:fileId/view',
  authorizePermission('files.download'),
  validateParams(fileParamsSchema),
  controller.stream,
)
storageRouter.get(
  '/:fileId/download',
  authorizePermission('files.download'),
  validateParams(fileParamsSchema),
  controller.stream,
)
storageRouter.delete(
  '/:fileId',
  authorizePermission('files.delete'),
  validateParams(fileParamsSchema),
  controller.remove,
)
