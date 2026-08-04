import type { RequestHandler } from 'express'
import { AppError } from '../../shared/errors/app-error'
import { pageRequest } from '../../shared/pagination'
import * as service from './invoice.service'

function context(request: Parameters<RequestHandler>[0]) {
  if (!request.auth?.tenantId || !request.tenant)
    throw new AppError('Tenant context is required', 'UNAUTHORIZED', 401)
  return { tenantId: request.auth.tenantId, userId: request.auth.userId }
}

function invoiceId(request: Parameters<RequestHandler>[0]) {
  return String(request.params.invoiceId)
}

export const list: RequestHandler = async (request, response) =>
  response.json({
    success: true,
    data: await service.list(context(request), {
      ...pageRequest(request.query),
      ...(typeof request.query.search === 'string'
        ? { search: request.query.search }
        : {}),
      ...(typeof request.query.status === 'string'
        ? { status: request.query.status }
        : {}),
      ...(typeof request.query.source === 'string'
        ? { source: request.query.source }
        : {}),
    }),
    message: 'Invoices retrieved',
  })

export const get: RequestHandler = async (request, response) =>
  response.json({
    success: true,
    data: await service.get(context(request), invoiceId(request)),
    message: 'Invoice retrieved',
  })

export const generate: RequestHandler = async (request, response) =>
  response.json({
    success: true,
    data: await service.generate(context(request), invoiceId(request)),
    message: 'Invoice generated',
  })

export const options: RequestHandler = async (request, response) =>
  response.json({
    success: true,
    data: await service.options(context(request)),
    message: 'Invoice form options retrieved',
  })

export const create: RequestHandler = async (request, response) =>
  response.status(201).json({
    success: true,
    data: await service.save(
      context(request),
      null,
      request.body as service.InvoiceInput,
    ),
    message: 'Invoice draft created',
  })

export const update: RequestHandler = async (request, response) =>
  response.json({
    success: true,
    data: await service.save(
      context(request),
      invoiceId(request),
      request.body as service.InvoiceInput,
    ),
    message: 'Invoice updated',
  })

export const cancel: RequestHandler = async (request, response) =>
  response.json({
    success: true,
    data: await service.cancel(
      context(request),
      invoiceId(request),
      (request.body as { reason: string }).reason,
    ),
    message: 'Invoice cancelled',
  })
