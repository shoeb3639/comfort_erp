import { prisma } from '../../config/prisma'

export function findTenantContext(tenantId: string) {
  return prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, code: true, status: true },
  })
}

export function findCurrentSubscription(tenantId: string) {
  return prisma.tenantSubscription.findFirst({
    where: { tenantId },
    orderBy: [{ startsAt: 'desc' }, { createdAt: 'desc' }],
    select: {
      status: true,
      startsAt: true,
      expiresAt: true,
      trialEndsAt: true,
      graceEndsAt: true,
    },
  })
}
