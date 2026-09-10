import type { RequestHandler } from 'express'
import { AppError } from '../../shared/errors/app-error'
import { pageRequest } from '../../shared/pagination'
import * as service from './driver.service'
import type { DriverInput } from './driver.types'
import { getDriverLedger } from './driver-ledger.service'
function context(request: Parameters<RequestHandler>[0]) {
  if (!request.auth?.tenantId || !request.tenant)
    throw new AppError('Tenant context is required', 'UNAUTHORIZED', 401)
  return { tenantId: request.auth.tenantId, userId: request.auth.userId }
}
function id(request: Parameters<RequestHandler>[0]) {
  const value = request.params.driverId
  if (typeof value !== 'string')
    throw new AppError('Invalid ID', 'VALIDATION_ERROR', 400)
  return value
}
const send = (
  response: Parameters<RequestHandler>[1],
  data: unknown,
  message: string,
  status = 200,
) => response.status(status).json({ success: true, data, message })
export const list: RequestHandler = async (request, response) =>
  send(
    response,
    await service.listDrivers(context(request), {
      ...pageRequest(request.query),
      ...(typeof request.query.search === 'string'
        ? { search: request.query.search }
        : {}),
      ...(request.query.engagementType === 'OWN' ||
      request.query.engagementType === 'VENDOR'
        ? { engagementType: request.query.engagementType }
        : {}),
      ...(typeof request.query.vendorId === 'string'
        ? { vendorId: request.query.vendorId }
        : {}),
      ...(request.query.status === 'ACTIVE' ||
      request.query.status === 'INACTIVE'
        ? { status: request.query.status }
        : {}),
    }),
    'Drivers retrieved',
  )
export const get: RequestHandler = async (request, response) =>
  send(
    response,
    await service.getDriver(context(request), id(request)),
    'Driver retrieved',
  )
export const ledger: RequestHandler = async (request, response) =>
  send(
    response,
    await getDriverLedger(context(request).tenantId, id(request)),
    'Driver accounts retrieved',
  )
export const create: RequestHandler = async (request, response) =>
  send(
    response,
    await service.createDriver(context(request), request.body as DriverInput),
    'Driver created',
    201,
  )
export const update: RequestHandler = async (request, response) =>
  send(
    response,
    await service.updateDriver(
      context(request),
      id(request),
      request.body as DriverInput,
    ),
    'Driver updated',
  )
export const remove: RequestHandler = async (request, response) =>
  send(
    response,
    await service.deleteDriver(context(request), id(request)),
    'Driver deleted',
  )
