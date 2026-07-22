import type { RequestHandler } from 'express'

export const getHealth: RequestHandler = (_request, response) => {
  response.status(200).json({
    success: true,
    data: {
      service: 'cablix-backend',
      status: 'ok',
    },
    message: 'Service is healthy',
  })
}
