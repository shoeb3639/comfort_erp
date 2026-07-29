import type { RequestHandler } from 'express'
import { AppError } from '../../shared/errors/app-error'
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
      ...(typeof request.query.search === 'string'
        ? { search: request.query.search }
        : {}),
      ...(typeof request.query.status === 'string'
        ? { status: request.query.status }
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
