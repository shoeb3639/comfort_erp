import type { RequestHandler } from 'express'
import { AppError } from '../../shared/errors/app-error'
import { pageRequest } from '../../shared/pagination'
import * as service from './booking.service'
import type {
  AssignmentInput,
  BookingInput,
  CloseBookingInput,
  CollectionInput,
  CreateBookingInput,
  DutyCompleteInput,
  DutyStartInput,
} from './booking.service'

function context(request: Parameters<RequestHandler>[0]) {
  if (!request.auth?.tenantId || !request.tenant)
    throw new AppError('Tenant context is required', 'UNAUTHORIZED', 401)
  return { tenantId: request.auth.tenantId, userId: request.auth.userId }
}
function id(request: Parameters<RequestHandler>[0]) {
  if (typeof request.params.bookingId !== 'string')
    throw new AppError('Invalid booking ID', 'VALIDATION_ERROR', 400)
  return request.params.bookingId
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
    await service.list(context(request), {
      ...pageRequest(request.query),
      ...(typeof request.query.search === 'string'
        ? { search: request.query.search }
        : {}),
      ...(typeof request.query.status === 'string'
        ? { status: request.query.status }
        : {}),
      ...(typeof request.query.view === 'string'
        ? { view: request.query.view }
        : {}),
    }),
    'Bookings retrieved',
  )
export const get: RequestHandler = async (request, response) =>
  send(
    response,
    await service.get(context(request), id(request)),
    'Booking retrieved',
  )
export const create: RequestHandler = async (request, response) =>
  send(
    response,
    await service.create(context(request), request.body as CreateBookingInput),
    'Booking created',
    201,
  )
export const update: RequestHandler = async (request, response) =>
  send(
    response,
    await service.update(
      context(request),
      id(request),
      request.body as BookingInput,
    ),
    'Booking updated',
  )
export const assign: RequestHandler = async (request, response) =>
  send(
    response,
    await service.assign(
      context(request),
      id(request),
      request.body as AssignmentInput,
    ),
    'Duty assigned',
  )
export const confirm: RequestHandler = async (request, response) =>
  send(
    response,
    await service.confirm(context(request), id(request)),
    'Booking confirmed',
  )
export const startDuty: RequestHandler = async (request, response) =>
  send(
    response,
    await service.startDuty(
      context(request),
      id(request),
      request.body as DutyStartInput,
    ),
    'Duty started',
  )
export const completeDuty: RequestHandler = async (request, response) =>
  send(
    response,
    await service.completeDuty(
      context(request),
      id(request),
      request.body as DutyCompleteInput,
    ),
    'Duty completed',
  )
export const cancel: RequestHandler = async (request, response) =>
  send(
    response,
    await service.cancel(
      context(request),
      id(request),
      (request.body as { reason: string }).reason,
    ),
    'Booking cancelled',
  )
export const close: RequestHandler = async (request, response) =>
  send(
    response,
    await service.close(
      context(request),
      id(request),
      request.body as CloseBookingInput,
    ),
    'Booking closed',
  )
export const profit: RequestHandler = async (request, response) =>
  send(
    response,
    await service.getProfit(context(request), id(request)),
    'Booking profit retrieved',
  )
export const addCollection: RequestHandler = async (request, response) =>
  send(
    response,
    await service.addCollection(
      context(request),
      id(request),
      request.body as CollectionInput,
    ),
    'Collection recorded',
    201,
  )
export const verifyCollection: RequestHandler = async (request, response) =>
  send(
    response,
    await service.verifyCollection(
      context(request),
      id(request),
      String(request.params.collectionId),
      (request.body as { verifiedBy?: string | null }).verifiedBy,
    ),
    'Collection verified',
  )
export const voidCollection: RequestHandler = async (request, response) =>
  send(
    response,
    await service.voidCollection(
      context(request),
      id(request),
      String(request.params.collectionId),
    ),
    'Collection voided',
  )
export const remove: RequestHandler = async (request, response) =>
  send(
    response,
    await service.remove(context(request), id(request)),
    'Booking deleted',
  )
export const getPrefix: RequestHandler = async (request, response) =>
  send(
    response,
    await service.getPrefix(context(request)),
    'Booking settings retrieved',
  )
export const setPrefix: RequestHandler = async (request, response) =>
  send(
    response,
    await service.setPrefix(
      context(request),
      (request.body as { bookingPrefix: string }).bookingPrefix,
    ),
    'Booking prefix updated',
  )
