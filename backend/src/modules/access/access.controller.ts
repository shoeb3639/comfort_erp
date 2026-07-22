import type { RequestHandler } from 'express'

export const getPlatformContext: RequestHandler = (request, response) => {
  response.status(200).json({
    success: true,
    data: { auth: request.auth },
    message: 'Platform context retrieved',
  })
}

export const getTenantContext: RequestHandler = (request, response) => {
  response.status(200).json({
    success: true,
    data: { auth: request.auth, tenant: request.tenant },
    message: 'Tenant context retrieved',
  })
}
