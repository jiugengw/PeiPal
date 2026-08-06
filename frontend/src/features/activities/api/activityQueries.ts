import { apiQueryOptions } from '@/lib/fetchClient'



export interface ActivityFilters {

  location?: string

  limit?: number

}



/** Initial results shown on the discovery page. */

export const DEFAULT_ACTIVITY_RESULTS_LIMIT = 6



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

