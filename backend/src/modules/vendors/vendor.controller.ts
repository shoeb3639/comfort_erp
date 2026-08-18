import type { RequestHandler } from 'express'
import { AppError } from '../../shared/errors/app-error'
import { pageRequest } from '../../shared/pagination'
import * as service from './vendor.service'
import type { DriverInput, VehicleInput, VendorInput } from './vendor.types'

function context(request: Parameters<RequestHandler>[0]) {
  if (!request.auth?.tenantId || !request.tenant) {
    throw new AppError('Tenant context is required', 'UNAUTHORIZED', 401)
  }
  return { tenantId: request.auth.tenantId, userId: request.auth.userId }
}
function param(request: Parameters<RequestHandler>[0], name: string) {
  const value = request.params[name]
  if (typeof value !== 'string')
    throw new AppError('Invalid ID', 'VALIDATION_ERROR', 400)
  return value
}
function send(
  response: Parameters<RequestHandler>[1],
  data: unknown,
  message: string,
  status = 200,
) {
  response.status(status).json({ success: true, data, message })
}
export const list: RequestHandler = async (request, response) =>
  send(
    response,
    await service.listVendors(context(request), {
      ...pageRequest(request.query),
      ...(typeof request.query.search === 'string'
        ? { search: request.query.search }
        : {}),
      ...(typeof request.query.recordType === 'string'
        ? { recordType: request.query.recordType }
        : {}),
      ...(request.query.status === 'ACTIVE' ||
      request.query.status === 'INACTIVE'
        ? { status: request.query.status }
        : {}),
    }),
    'Vendors retrieved',
  )
export const get: RequestHandler = async (request, response) =>
  send(
    response,
    await service.getVendor(context(request), param(request, 'vendorId')),
    'Vendor retrieved',
  )
export const create: RequestHandler = async (request, response) =>
  send(
    response,
    await service.createVendor(
      context(request),
      request.body as Required<
        Pick<VendorInput, 'name' | 'category' | 'phone' | 'city'>
      > &
        VendorInput,
    ),
    'Vendor created',
    201,
  )
export const update: RequestHandler = async (request, response) =>
  send(
    response,
    await service.updateVendor(
      context(request),
      param(request, 'vendorId'),
      request.body as VendorInput,
    ),
    'Vendor updated',
  )
export const remove: RequestHandler = async (request, response) =>
  send(
    response,
    await service.deleteVendor(context(request), param(request, 'vendorId')),
    'Vendor deleted',
  )
export const createVehicle: RequestHandler = async (request, response) =>
  send(
    response,
    await service.createVehicle(
      context(request),
      param(request, 'vendorId'),
      request.body as Required<
        Pick<VehicleInput, 'plate' | 'type' | 'make' | 'seatingCapacity'>
      > &
        VehicleInput,
    ),
    'Vehicle created',
    201,
  )
export const updateVehicle: RequestHandler = async (request, response) =>
  send(
    response,
    await service.updateVehicle(
      context(request),
      param(request, 'vendorId'),
      param(request, 'childId'),
      request.body as VehicleInput,
    ),
    'Vehicle updated',
  )
export const deleteVehicle: RequestHandler = async (request, response) =>
  send(
    response,
    await service.deleteVehicle(
      context(request),
      param(request, 'vendorId'),
      param(request, 'childId'),
    ),
    'Vehicle deleted',
  )
export const createDriver: RequestHandler = async (request, response) =>
  send(
    response,
    await service.createDriver(
      context(request),
      param(request, 'vendorId'),
      request.body as Required<
        Pick<DriverInput, 'name' | 'license' | 'phone' | 'city'>
      > &
        DriverInput,
    ),
    'Driver created',
    201,
  )
export const updateDriver: RequestHandler = async (request, response) =>
  send(
    response,
    await service.updateDriver(
      context(request),
      param(request, 'vendorId'),
      param(request, 'childId'),
      request.body as DriverInput,
    ),
    'Driver updated',
  )
export const deleteDriver: RequestHandler = async (request, response) =>
  send(
    response,
    await service.deleteDriver(
      context(request),
      param(request, 'vendorId'),
      param(request, 'childId'),
    ),
    'Driver deleted',
  )
