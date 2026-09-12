import type { RequestHandler } from 'express'
import { pageRequest } from '../../shared/pagination'
import * as service from './city.service'

export const searchIndianCities: RequestHandler = async (request, response) => {
  const data = await service.searchIndianCities({
    ...pageRequest(request.query),
    ...(typeof request.query.q === 'string' ? { query: request.query.q } : {}),
  })
  response.json({ success: true, data, message: 'Indian cities retrieved' })
}

export const searchReportingPlaces: RequestHandler = async (
  request,
  response,
) => {
  const query = request.query.q
  const data = await service.searchReportingPlaces({
    query: typeof query === 'string' ? query : '',
    ...(typeof request.query.latitude === 'number'
      ? { latitude: request.query.latitude }
      : {}),
    ...(typeof request.query.longitude === 'number'
      ? { longitude: request.query.longitude }
      : {}),
  })
  response.json({
    success: true,
    data,
    message: data.providerAvailable
      ? 'Reporting places retrieved'
      : 'Address suggestions are unavailable; manual entry remains available',
  })
}
