process.env.NODE_ENV = 'test'
process.env.DATABASE_URL ??=
  'postgresql://postgres@127.0.0.1:5433/cablix_erp_test?schema=public'
process.env.JWT_ACCESS_SECRET ??=
  'test-access-secret-that-is-at-least-thirty-two-characters'
process.env.JWT_REFRESH_SECRET ??=
  'test-refresh-secret-that-is-at-least-thirty-two-characters'
process.env.ACCESS_TOKEN_TTL ??= '900'
process.env.REFRESH_TOKEN_TTL ??= '604800'
process.env.JWT_ISSUER ??= 'cablix-api-test'
process.env.JWT_AUDIENCE ??= 'cablix-app-test'
