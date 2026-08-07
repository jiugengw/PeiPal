import { queryOptions } from '@tanstack/react-query'
import type { components } from '@/generated/api'
import { fetchClient } from '@/lib/fetchClient'

export type Plan = components['schemas']['PlanResponse']
export type PlanStatus = Plan['status']

export class PlanRequestError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'PlanRequestError'
    this.status = status
  }
}

function detailMessage(error: unknown, fallback: string) {
  if (error && typeof error === 'object' && 'detail' in error) {
    const detail = (error as { detail?: unknown }).detail
    if (typeof detail === 'string') return detail
  }
  return fallback
}

export const planQueryKey = (planId: number) => ['plan', planId] as const
export const activityDetailQueryKey = (activityId: number) => ['activity', activityId] as const
export const plansQueryKey = (familyId: number, status?: string) => ['plans', familyId, status ?? 'all'] as const

export function planQueryOptions(planId: number) {
  return queryOptions({
    queryKey: planQueryKey(planId),
    queryFn: async () => {
      const { data, error, response } = await fetchClient.GET('/api/plans/{plan_id}', {
        params: { path: { plan_id: planId } },
      })
      if (error || !data) throw new PlanRequestError(detailMessage(error, 'We could not load this plan.'), response.status)
      return data
    },
  })
}

export function activityDetailQueryOptions(activityId: number) {
  return queryOptions({
    queryKey: activityDetailQueryKey(activityId),
    queryFn: async () => {
      const { data, error, response } = await fetchClient.GET('/api/activities/{activity_id}', {
        params: { path: { activity_id: activityId } },
      })
      if (error || !data) throw new PlanRequestError(detailMessage(error, 'We could not load the activity for this plan.'), response.status)
      return data
    },
  })
}

export function plansQueryOptions(familyId: number, status?: PlanStatus) {
  return queryOptions({
    queryKey: plansQueryKey(familyId, status),
    queryFn: async () => {
      const { data, error, response } = await fetchClient.GET('/api/plans', {
        params: { query: { family_id: familyId, status } },
      })
      if (error || !data) throw new PlanRequestError(detailMessage(error, 'We could not load your plans.'), response.status)
      return data
    },
  })
}

export async function createPlan(body: components['schemas']['PlanCreate']) {
  const { data, error, response } = await fetchClient.POST('/api/plans', { body })
  if (error || !data) throw new PlanRequestError(detailMessage(error, 'We could not create the plan yet.'), response.status)
  return data
}

export async function updatePlanStatus(
  planId: number,
  status: components['schemas']['PlanUpdate']['status'],
  note?: string,
) {
  const { data, error, response } = await fetchClient.PATCH('/api/plans/{plan_id}', {
    params: { path: { plan_id: planId } },
    body: note?.trim() ? { status, note: note.trim() } : { status },
  })
  if (error || !data) throw new PlanRequestError(detailMessage(error, 'We could not update the plan yet.'), response.status)
  return data
}
