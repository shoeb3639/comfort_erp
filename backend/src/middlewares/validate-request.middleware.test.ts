import type { NextFunction, Request, Response } from 'express'
import Joi from 'joi'
import { validateBody, validateQuery } from './validate-request.middleware'

function run(
  handler: ReturnType<typeof validateBody>,
  request: Partial<Request>,
) {
  const next = jest.fn<ReturnType<NextFunction>, Parameters<NextFunction>>()
  handler(request as Request, {} as Response, next)
  return next
}

describe('request validation normalization', () => {
  it('normalizes validated form data before the controller receives it', () => {
    const request = {
      body: {
        email: '  OWNER@EXAMPLE.COM ',
        mobile: '+91 98765-43210',
        password: '  Password Kept Exactly  ',
      },
    }

    const next = run(
      validateBody(
        Joi.object({
          email: Joi.string().required(),
          mobile: Joi.string().required(),
          password: Joi.string().required(),
        }),
      ),
      request,
    )

    expect(next).toHaveBeenCalledWith()
    expect(request.body).toEqual({
      email: 'owner@example.com',
      mobile: '+919876543210',
      password: '  Password Kept Exactly  ',
    })
  })

  it('stores the validated and normalized query values on the request', () => {
    const request = { query: { search: '  Innova  ' } }
    const next = run(
      validateQuery(Joi.object({ search: Joi.string().required() })),
      request,
    )

    expect(next).toHaveBeenCalledWith()
    expect(request.query).toEqual({ search: 'Innova' })
  })
})
