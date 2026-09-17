import type { Prisma } from '../../generated/prisma/client'
import { prisma } from '../../config/prisma'
import type { PageRequest } from '../../shared/pagination'
import { pageWindow } from '../../shared/pagination'

export function searchIndianCities(filters: PageRequest & { query?: string }) {
  const query = filters.query?.trim()
  const where: Prisma.IndianCityWhereInput = query
    ? {
        OR: [
          { name: { contains: query, mode: 'insensitive' as const } },
          { stateName: { contains: query, mode: 'insensitive' as const } },
        ],
      }
    : {}
  return Promise.all([
    prisma.indianCity.findMany({
      where,
      select: {
        id: true,
        name: true,
        stateName: true,
        stateCode: true,
        latitude: true,
        longitude: true,
      },
      orderBy: [{ name: 'asc' }, { stateName: 'asc' }],
      ...pageWindow(filters),
    }),
    prisma.indianCity.count({ where }),
  ]) satisfies Promise<
    [
      Array<{
        id: string
        name: string
        stateName: string
        stateCode: string
        latitude: Prisma.Decimal | null
        longitude: Prisma.Decimal | null
      }>,
      number,
    ]
  >
}
