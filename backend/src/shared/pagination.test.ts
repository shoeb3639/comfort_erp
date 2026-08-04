import {
  pageRequest,
  pageResult,
  pageWindow,
  paginationQueryFields,
} from './pagination'
import Joi from 'joi'

describe('pagination', () => {
  it('applies bounded query defaults', () => {
    const schema = Joi.object(paginationQueryFields)
    expect(schema.validate({}).value).toMatchObject({ page: 1, limit: 25 })
    expect(schema.validate({ page: 2, limit: 101 }).error).toBeDefined()
  })

  it('builds database windows and response metadata', () => {
    const request = pageRequest({ page: '3', limit: '10' })
    expect(pageWindow(request)).toEqual({ skip: 20, take: 10 })
    expect(pageResult(['row'], 26, request).pagination).toEqual({
      page: 3,
      limit: 10,
      total: 26,
      pages: 3,
      hasPrevious: true,
      hasNext: false,
    })
  })
})
