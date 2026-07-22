import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const schema = readFileSync(
  join(process.cwd(), 'prisma', 'schema.prisma'),
  'utf8',
)

function modelBody(modelName: string): string {
  const match = schema.match(
    new RegExp(`model ${modelName} \\{([\\s\\S]*?)\\n\\}`),
  )
  if (!match?.[1]) {
    throw new Error(`Prisma model ${modelName} was not found`)
  }

  return match[1]
}

describe('Prisma tenant isolation', () => {
  const tenantOwnedModels = [
    'TenantSubscription',
    'TenantRole',
    'TenantRolePermission',
    'TenantUser',
    'TenantRefreshToken',
    'TenantOnboardingItem',
    'TenantAuditLog',
  ]

  it.each(tenantOwnedModels)('%s contains tenantId', (modelName) => {
    expect(modelBody(modelName)).toMatch(/\btenantId\s+String\b/)
  })

  it('keeps platform users independent from tenant context', () => {
    expect(modelBody('PlatformUser')).not.toMatch(/\btenantId\b/)
  })
})
