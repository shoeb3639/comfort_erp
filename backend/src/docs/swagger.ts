import swaggerJsdoc from 'swagger-jsdoc'

export const swaggerSpecification = swaggerJsdoc({
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Cablix ERP API',
      version: '1.0.0',
      description: 'Multi-tenant SaaS ERP API for car rental operations.',
    },
    servers: [{ url: '/api/v1' }],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
    },
  },
  apis: ['src/modules/**/*.routes.ts', 'dist/modules/**/*.routes.js'],
})
