import type { Prisma } from '../../generated/prisma/client'
import { prisma } from '../../config/prisma'

const platformUserInclude = {
  role: {
    include: {
      permissions: { include: { permission: true } },
    },
  },
} satisfies Prisma.PlatformUserInclude

const tenantUserInclude = {
  tenant: true,
  role: {
    include: {
      permissions: { include: { permission: true } },
    },
  },
} satisfies Prisma.TenantUserInclude

export function findPlatformUserByEmail(email: string) {
  return prisma.platformUser.findUnique({
    where: { email },
    include: platformUserInclude,
  })
}

export function findTenantUsersByEmail(email: string) {
  return prisma.tenantUser.findMany({
    where: { email, deletedAt: null },
    include: tenantUserInclude,
  })
}

export function findPlatformUserStatus(userId: string) {
  return prisma.platformUser.findUnique({
    where: { id: userId },
    select: { status: true, roleId: true },
  })
}

export function findTenantUserStatus(tenantId: string, userId: string) {
  return prisma.tenantUser.findUnique({
    where: { tenantId_id: { tenantId, id: userId } },
    select: { status: true, roleId: true, deletedAt: true },
  })
}

export function findPlatformRefreshToken(tokenHash: string) {
  return prisma.platformRefreshToken.findUnique({
    where: { tokenHash },
    include: {
      platformUser: { include: platformUserInclude },
    },
  })
}

export function findTenantRefreshToken(tokenHash: string) {
  return prisma.tenantRefreshToken.findUnique({
    where: { tokenHash },
    include: {
      user: { include: tenantUserInclude },
    },
  })
}

export function createPlatformRefreshToken(input: {
  platformUserId: string
  tokenHash: string
  expiresAt: Date
  ipAddress: string | null
  userAgent: string | null
}) {
  return prisma.platformRefreshToken.create({ data: input })
}

export function createTenantRefreshToken(input: {
  tenantId: string
  userId: string
  tokenHash: string
  expiresAt: Date
  ipAddress: string | null
  userAgent: string | null
}) {
  return prisma.tenantRefreshToken.create({ data: input })
}

export function rotatePlatformRefreshToken(input: {
  currentTokenId: string
  platformUserId: string
  tokenHash: string
  expiresAt: Date
  ipAddress: string | null
  userAgent: string | null
}) {
  return prisma.$transaction(async (transaction) => {
    const revoked = await transaction.platformRefreshToken.updateMany({
      where: { id: input.currentTokenId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    if (revoked.count !== 1) return false

    await transaction.platformRefreshToken.create({
      data: {
        platformUserId: input.platformUserId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    })
    return true
  })
}

export function rotateTenantRefreshToken(input: {
  currentTokenId: string
  tenantId: string
  userId: string
  tokenHash: string
  expiresAt: Date
  ipAddress: string | null
  userAgent: string | null
}) {
  return prisma.$transaction(async (transaction) => {
    const revoked = await transaction.tenantRefreshToken.updateMany({
      where: { id: input.currentTokenId, revokedAt: null },
      data: { revokedAt: new Date() },
    })
    if (revoked.count !== 1) return false

    await transaction.tenantRefreshToken.create({
      data: {
        tenantId: input.tenantId,
        userId: input.userId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
      },
    })
    return true
  })
}

export function revokePlatformRefreshToken(tokenHash: string) {
  return prisma.platformRefreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

export function revokeTenantRefreshToken(tokenHash: string) {
  return prisma.tenantRefreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

export function updatePlatformLastLogin(userId: string) {
  return prisma.platformUser.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
  })
}

export function updateTenantLastLogin(tenantId: string, userId: string) {
  return prisma.tenantUser.update({
    where: { tenantId_id: { tenantId, id: userId } },
    data: { lastLoginAt: new Date() },
  })
}
