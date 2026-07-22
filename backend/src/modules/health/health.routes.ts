import { Router } from 'express'
import { getHealth } from './health.controller'

export const healthRouter = Router()

/**
 * @openapi
 * /api/v1/public/health:
 *   get:
 *     summary: Check API health
 *     tags:
 *       - Public
 *     responses:
 *       200:
 *         description: The API is healthy.
 */
healthRouter.get('/', getHealth)
