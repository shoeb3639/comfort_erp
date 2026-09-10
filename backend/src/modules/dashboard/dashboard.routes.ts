import { vehiclePerformance } from './vehicle-performance'
import { outstandingCustomers } from './outstanding-customers'
import { Router } from 'express'
import Joi from 'joi'
import { authenticateUser } from '../../middlewares/authenticate-user.middleware'
import { authorizePermission } from '../../middlewares/authorize-permission.middleware'
import { checkSubscription } from '../../middlewares/check-subscription.middleware'
import { checkTenantStatus } from '../../middlewares/check-tenant-status.middleware'
import { resolveTenant } from '../../middlewares/resolve-tenant.middleware'
import { AppError } from '../../shared/errors/app-error'
import { cardMetric, metricKeys, type MetricKey } from './card-metrics'

const schema = Joi.object({
  metric: Joi.string()
    .valid(...metricKeys)
    .required(),
  start: Joi.string().required(),
  end: Joi.string().required(),
})
export const dashboardRouter = Router()
dashboardRouter.use(
  authenticateUser,
  resolveTenant,
  checkTenantStatus,
  checkSubscription({ allowRestrictedRead: true }),
  authorizePermission('reports.view'),
)
dashboardRouter.get('/card', async (req, res) => {
  const result = schema.validate(req.query)
  if (result.error)
    throw new AppError(
      'Select a valid metric and date range',
      'VALIDATION_ERROR',
      400,
    )
  const { metric, start, end } = result.value as {
    metric: MetricKey
    start: string
    end: string
  }
  res.json({
    success: true,
    data: await cardMetric(req.auth!.tenantId!, metric, start, end),
  })
})

const outstandingSchema = Joi.object({ date: Joi.string() })
dashboardRouter.get('/outstanding-customers', async (req, res) => {
  const result = outstandingSchema.validate(req.query)
  if (result.error)
    throw new AppError('Select a valid date', 'VALIDATION_ERROR', 400)
  res.json({
    success: true,
    data: await outstandingCustomers(
      req.auth!.tenantId!,
      (result.value as { date?: string }).date,
    ),
  })
})

const vehicleSchema = Joi.object({
  start: Joi.string(),
  end: Joi.string(),
  ownership: Joi.string().valid('OWN', 'VENDOR').default('OWN'),
}).and('start', 'end')
dashboardRouter.get('/vehicle-performance', async (req, res) => {
  const result = vehicleSchema.validate(req.query)
  if (result.error)
    throw new AppError(
      'Select a valid vehicle type and date range',
      'VALIDATION_ERROR',
      400,
    )
  res.json({
    success: true,
    data: await vehiclePerformance(
      req.auth!.tenantId!,
      (result.value as { ownership: 'OWN' | 'VENDOR' }).ownership,
      (result.value as { start?: string }).start,
      (result.value as { end?: string }).end,
    ),
  })
})
