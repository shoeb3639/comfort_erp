import type { RequestHandler } from 'express'
import { AppError } from '../../shared/errors/app-error'
import { pageRequest } from '../../shared/pagination'
import * as service from './vehicle.service'
import type { VehicleInput, VehicleLedgerGroupBy } from './vehicle.types'

function context(request: Parameters<RequestHandler>[0]) {
  if (!request.auth?.tenantId || !request.tenant)
    throw new AppError('Tenant context is required', 'UNAUTHORIZED', 401)
  return { tenantId: request.auth.tenantId, userId: request.auth.userId }
}
function id(request: Parameters<RequestHandler>[0]) {
  const value = request.params.vehicleId
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

function query(request: Parameters<RequestHandler>[0], name: string) {
  const value = request.query[name]
  return typeof value === 'string' ? value : undefined
}

function ledgerBoundary(value: string, endOfDay = false) {
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value)
  return new Date(
    isDateOnly
      ? `${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`
      : value,
  )
}

export const list: RequestHandler = async (request, response) =>
  send(
    response,
    await service.listVehicles(context(request), {
      ...pageRequest(request.query),
      ...(typeof request.query.search === 'string'
        ? { search: request.query.search }
        : {}),
      ...(request.query.ownershipType === 'OWN' ||
      request.query.ownershipType === 'VENDOR'
        ? { ownershipType: request.query.ownershipType }
        : {}),
      ...(typeof request.query.vendorId === 'string'
        ? { vendorId: request.query.vendorId }
        : {}),
      ...(typeof request.query.vehicleTypeId === 'string'
        ? { vehicleTypeId: request.query.vehicleTypeId }
        : {}),
      ...(request.query.status === 'ACTIVE' ||
      request.query.status === 'INACTIVE'
        ? { status: request.query.status }
        : {}),
    }),
    'Vehicles retrieved',
  )
export const types: RequestHandler = async (request, response) =>
  send(
    response,
    await service.listVehicleTypes(context(request)),
    'Vehicle types retrieved',
  )
export const createType: RequestHandler = async (request, response) =>
  send(
    response,
    await service.createVehicleType(
      context(request),
      request.body as { name: string },
    ),
    'Vehicle type created',
    201,
  )
export const get: RequestHandler = async (request, response) =>
  send(
    response,
    await service.getVehicle(context(request), id(request)),
    'Vehicle retrieved',
  )
export const ledger: RequestHandler = async (request, response) => {
  const dateFrom = query(request, 'dateFrom')
  const dateTo = query(request, 'dateTo')
  const profitDataStatus = query(request, 'profitDataStatus')
  send(
    response,
    await service.getVehicleLedger(context(request), id(request), {
      ...pageRequest(request.query),
      groupBy: (query(request, 'groupBy') || 'MONTH') as VehicleLedgerGroupBy,
      ...(dateFrom ? { dateFrom: ledgerBoundary(dateFrom) } : {}),
      ...(dateTo ? { dateTo: ledgerBoundary(dateTo, true) } : {}),
      ...(profitDataStatus === 'NOT_TRACKED' ||
      profitDataStatus === 'AVAILABLE' ||
      profitDataStatus === 'INCOMPLETE' ||
      profitDataStatus === 'REGISTER_ONLY'
        ? { profitDataStatus }
        : {}),
    }),
    'Vehicle ledger retrieved',
  )
}
export const create: RequestHandler = async (request, response) =>
  send(
    response,
    await service.createVehicle(context(request), request.body as VehicleInput),
    'Vehicle created',
    201,
  )
export const update: RequestHandler = async (request, response) =>
  send(
    response,
    await service.updateVehicle(
      context(request),
      id(request),
      request.body as VehicleInput,
    ),
    'Vehicle updated',
  )
export const remove: RequestHandler = async (request, response) =>
  send(
    response,
    await service.deleteVehicle(context(request), id(request)),
    'Vehicle deleted',
  )
