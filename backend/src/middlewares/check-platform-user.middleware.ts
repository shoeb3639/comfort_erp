import type { RequestHandler } from 'express'
import { AppError } from '../shared/errors/app-error'

export const checkPlatformUser: RequestHandler = (request, _response, next) => {
  if (!request.auth || request.auth.userType !== 'PLATFORM') {
    next(new AppError('Platform access is required', 'FORBIDDEN', 403))
    return
  }
  next()
}
