import { apiQueryOptions } from '@/lib/fetchClient'

export interface ActivityFilters {
  location?: string
  limit?: number
}

export function activitiesQueryOptions(
  filters: ActivityFilters = {},
) {
  return apiQueryOptions('get', '/api/activities', {
    params: {
      query: {
        limit: filters.limit ?? 3,
        ...(filters.location?.trim() ? { location: filters.location.trim() } : {}),
      },
    },
  })
}
