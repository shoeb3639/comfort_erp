import { citySearchQuerySchema, placeSearchQuerySchema } from './city.schema'

describe('Indian city search schema', () => {
  it('uses bounded pagination defaults', () => {
    expect(citySearchQuerySchema.validate({ q: 'pray' }).value).toMatchObject({
      q: 'pray',
      page: 1,
      limit: 20,
    })
    expect(citySearchQuerySchema.validate({ limit: 51 }).error).toBeDefined()
  })

  it('validates locality search and requires complete coordinate bias', () => {
    expect(
      placeSearchQuerySchema.validate({
        q: 'Civil Lines',
        latitude: 25.4358,
        longitude: 81.8463,
      }).error,
    ).toBeUndefined()
    expect(
      placeSearchQuerySchema.validate({ q: 'Civil Lines', latitude: 25.4358 })
        .error,
    ).toBeDefined()
    expect(placeSearchQuerySchema.validate({ q: 'ab' }).error).toBeDefined()
  })
})
