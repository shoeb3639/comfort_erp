import request from 'supertest'
import { app } from '../../app'

describe('health endpoint', () => {
  it('returns the standard success response', async () => {
    const response = await request(app).get('/api/v1/public/health')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      success: true,
      data: {
        service: 'cablix-backend',
        status: 'ok',
      },
      message: 'Service is healthy',
    })
  })

  it('returns a standardized error for an unknown route', async () => {
    const response = await request(app).get('/api/v1/unknown')

    expect(response.status).toBe(404)
    expect(response.body).toMatchObject({
      success: false,
      code: 'NOT_FOUND',
      details: [],
    })
  })
})
