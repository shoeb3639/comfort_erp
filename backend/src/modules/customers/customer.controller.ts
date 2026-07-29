import type { RequestHandler } from 'express'
import type { CustomerStatus, CustomerType } from '../../generated/prisma/enums'
import { AppError } from '../../shared/errors/app-error'
import * as service from './customer.service'
import type { CustomerInput, TravellerInput } from './customer.service'

function context(request: Parameters<RequestHandler>[0]) {
  if (!request.auth?.tenantId || !request.tenant) {
    throw new AppError('Tenant context is required', 'UNAUTHORIZED', 401)
  }
  return { tenantId: request.auth.tenantId, userId: request.auth.userId }
}

function customerId(request: Parameters<RequestHandler>[0]) {
  const id = request.params.customerId
  if (typeof id !== 'string') {
    throw new AppError('Invalid customer ID', 'VALIDATION_ERROR', 400)
  }
  return id
}

function travellerId(request: Parameters<RequestHandler>[0]) {
  const id = request.params.travellerId
  if (typeof id !== 'string') {
    throw new AppError('Invalid employee ID', 'VALIDATION_ERROR', 400)
  }
  return id
}

function send(
  response: Parameters<RequestHandler>[1],
  data: unknown,
  message: string,
  status = 200,
) {
  response.status(status).json({ success: true, data, message })
}

export const listCustomers: RequestHandler = async (request, response) =>
  send(
    response,
    await service.listCustomers(context(request), {
      ...(typeof request.query.search === 'string'
        ? { search: request.query.search }
        : {}),
      ...(typeof request.query.type === 'string'
        ? { type: request.query.type as CustomerType }
        : {}),
      ...(typeof request.query.status === 'string'
        ? { status: request.query.status as CustomerStatus }
        : {}),
    }),
    'Customers retrieved',
  )

export const getCustomer: RequestHandler = async (request, response) =>
  send(
    response,
    await service.getCustomer(context(request), customerId(request)),
    'Customer retrieved',
  )

export const createCustomer: RequestHandler = async (request, response) =>
  send(
    response,
    await service.createCustomer(
      context(request),
      request.body as Required<
        Pick<
          CustomerInput,
          | 'type'
          | 'name'
          | 'billingName'
          | 'email'
          | 'phone'
          | 'city'
          | 'billingAddress'
        >
      > &
        CustomerInput,
    ),
    'Customer created',
    201,
  )

export const updateCustomer: RequestHandler = async (request, response) =>
  send(
    response,
    await service.updateCustomer(
      context(request),
      customerId(request),
      request.body as CustomerInput,
    ),
    'Customer updated',
  )

export const createTraveller: RequestHandler = async (request, response) =>
  send(
    response,
    await service.createTraveller(
      context(request),
      customerId(request),
      request.body as TravellerInput,
    ),
    'Traveller created',
    201,
  )

export const getTraveller: RequestHandler = async (request, response) =>
  send(
    response,
    await service.getTraveller(
      context(request),
      customerId(request),
      travellerId(request),
    ),
    'Employee retrieved',
  )

export const updateTraveller: RequestHandler = async (request, response) =>
  send(
    response,
    await service.updateTraveller(
      context(request),
      customerId(request),
      travellerId(request),
      request.body as Partial<TravellerInput>,
    ),
    'Employee updated',
  )
