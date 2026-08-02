import type { RequestHandler } from 'express'
import { AppError } from '../../shared/errors/app-error'
import type { ReportFilters } from './report.repository'
import type { ReportKey } from './report.schema'
import * as service from './report.service'

function context(request: Parameters<RequestHandler>[0]) {
  if (!request.auth?.tenantId || !request.tenant)
    throw new AppError('Tenant context is required', 'UNAUTHORIZED', 401)
  return { tenantId: request.auth.tenantId }
}

function query(request: Parameters<RequestHandler>[0], name: string) {
  const value = request.query[name]
  return typeof value === 'string' ? value : undefined
}

export const catalog: RequestHandler = (_request, response) => {
  response.status(200).json({
    success: true,
    data: service.getCatalog(),
    message: 'Report catalog retrieved',
  })
}

export const options: RequestHandler = async (request, response) => {
  response.status(200).json({
    success: true,
    data: await service.getOptions(context(request).tenantId),
    message: 'Report options retrieved',
  })
}

export const generate: RequestHandler = async (request, response) => {
  const dateFrom = query(request, 'dateFrom')
  const dateTo = query(request, 'dateTo')
  const status = query(request, 'status')
  const customerId = query(request, 'customerId')
  const vendorId = query(request, 'vendorId')
  const vehicleId = query(request, 'vehicleId')
  const assignmentSource = query(request, 'assignmentSource')
  const search = query(request, 'search')
  const filters: ReportFilters = {
    page: Number(query(request, 'page') || 1),
    limit: Number(query(request, 'limit') || 100),
    ...(dateFrom ? { dateFrom: new Date(dateFrom) } : {}),
    ...(dateTo ? { dateTo: new Date(dateTo) } : {}),
    ...(status ? { status } : {}),
    ...(customerId ? { customerId } : {}),
    ...(vendorId ? { vendorId } : {}),
    ...(vehicleId ? { vehicleId } : {}),
    ...(assignmentSource
      ? {
          assignmentSource: assignmentSource as 'OWN' | 'VENDOR',
        }
      : {}),
    ...(search ? { search } : {}),
  }
  response.status(200).json({
    success: true,
    data: await service.generate(
      context(request).tenantId,
      request.params.reportKey as ReportKey,
      filters,
    ),
    message: 'Report generated',
  })
}
