import { activitiesQueryOptions } from '@/features/activities/api/activityQueries'

describe('activitiesQueryOptions', () => {
  it('creates typed query options for the activities endpoint', () => {
    const options = activitiesQueryOptions({ location: ' Bishan ', limit: 5 })

    expect(options.queryKey).toContain('/api/activities')
    expect(options.queryKey).toContainEqual(expect.objectContaining({
      params: { query: { location: 'Bishan', limit: 5 } },
    }))
  })
})
