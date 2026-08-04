import Joi from 'joi'

export const DEFAULT_PAGE_SIZE = 25
export const MAX_PAGE_SIZE = 100

export const paginationQueryFields = {
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number()
    .integer()
    .min(1)
    .max(MAX_PAGE_SIZE)
    .default(DEFAULT_PAGE_SIZE),
}

export interface PageRequest {
  page: number
  limit: number
}

export function pageRequest(query: Record<string, unknown>): PageRequest {
  const page = Number(query.page ?? 1)
  const limit = Number(query.limit ?? DEFAULT_PAGE_SIZE)
  return { page, limit }
}

export function pageResult<T>(items: T[], total: number, request: PageRequest) {
  const pages = Math.max(1, Math.ceil(total / request.limit))
  return {
    items,
    pagination: {
      page: request.page,
      limit: request.limit,
      total,
      pages,
      hasPrevious: request.page > 1,
      hasNext: request.page < pages,
    },
  }
}

export function pageWindow(request: PageRequest) {
  return { skip: (request.page - 1) * request.limit, take: request.limit }
}
