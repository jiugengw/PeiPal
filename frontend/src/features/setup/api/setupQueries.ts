import { apiQueryOptions } from '@/lib/fetchClient'

export const householdsQueryOptions = () =>
  apiQueryOptions('get', '/api/households')

export const olderAdultsQueryOptions = (householdId: number) =>
  apiQueryOptions('get', '/api/households/{household_id}/older-adults', {
    params: { path: { household_id: householdId } },
  })

export const trustedContactsQueryOptions = (olderAdultId: number) =>
  apiQueryOptions('get', '/api/older-adults/{older_adult_id}/trusted-contacts', {
    params: { path: { older_adult_id: olderAdultId } },
  })
