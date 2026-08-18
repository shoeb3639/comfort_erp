import express from 'express'
import request from 'supertest'
import { createRateLimitMiddleware } from './rate-limit.middleware'

describe('rate-limit middleware', () => {
  it('returns the standard response and draft-8 headers after the limit', async () => {
    const testApp = express()
    testApp.use(
      createRateLimitMiddleware({
        identifier: 'test-policy',
        windowMs: 60_000,
        limit: 2,
        message: 'Test request limit reached.',
      }),
    )
    testApp.get('/resource', (_request, response) => {
      response.status(200).json({ success: true })
    })

    const first = await request(testApp).get('/resource')
    const second = await request(testApp).get('/resource')
    const limited = await request(testApp).get('/resource')

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect(first.headers.ratelimit).toContain('"test-policy"')
    expect(limited.status).toBe(429)
    expect(limited.headers['retry-after']).toBeDefined()
    expect(limited.body).toEqual({
      success: false,
      message: 'Test request limit reached.',
      code: 'RATE_LIMITED',
      details: [],
    })
  })

  it('does not count skipped requests', async () => {
    const testApp = express()
    testApp.use(
      createRateLimitMiddleware({
        identifier: 'skip-policy',
        windowMs: 60_000,
        limit: 1,
        message: 'Test request limit reached.',
        skip: (incomingRequest) => incomingRequest.path === '/health',
      }),
    )
    testApp.get('/health', (_request, response) => response.sendStatus(200))
    testApp.get('/resource', (_request, response) => response.sendStatus(200))

    await request(testApp).get('/health').expect(200)
    await request(testApp).get('/health').expect(200)
    await request(testApp).get('/resource').expect(200)
    await request(testApp).get('/resource').expect(429)
  })
})
