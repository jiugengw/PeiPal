import { environment } from '@/services/environment'

interface ActivityDto { id: number | string; dedupe_key?: string | null; name: string; location: string; start_at?: string | null; cost?: number | null; description?: string | null; tags?: string[] | null; intensity?: string | null; info_link?: string | null }
export interface Activity { id: string; title: string; venue: string; startsAt: Date | null; cost: number | null; description: string; tags: string[]; infoLink: string | null }
export interface ListActivitiesOptions { location?: string; limit?: number; signal?: AbortSignal }

export class ApiError extends Error {
  readonly status: number
  constructor(message: string, status: number) { super(message); this.name = 'ApiError'; this.status = status }
}

function isActivity(value: unknown): value is ActivityDto {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return (typeof row.id === 'string' || typeof row.id === 'number') && typeof row.name === 'string' && typeof row.location === 'string'
}

function mapActivity(row: ActivityDto): Activity {
  const startsAt = row.start_at ? new Date(row.start_at) : null
  return { id: row.dedupe_key || String(row.id), title: row.name, venue: row.location, startsAt: startsAt && !Number.isNaN(startsAt.valueOf()) ? startsAt : null, cost: typeof row.cost === 'number' ? row.cost : null, description: row.description || 'Details are available on the event page.', tags: row.tags?.length ? row.tags : [row.intensity || 'Activity'], infoLink: row.info_link || null }
}

export async function listActivities(options: ListActivitiesOptions = {}): Promise<Activity[]> {
  const params = new URLSearchParams({ limit: String(options.limit ?? 3) })
  if (options.location?.trim()) params.set('location', options.location.trim())
  const response = await fetch(`${environment.apiBaseUrl}/api/activities?${params}`, { signal: options.signal, headers: { Accept: 'application/json' } })
  if (!response.ok) throw new ApiError('Could not load activities.', response.status)
  const payload: unknown = await response.json()
  const activities = (payload as { activities?: unknown })?.activities
  if (!Array.isArray(activities) || !activities.every(isActivity)) throw new ApiError('The activity service returned an unexpected response.', response.status)
  return activities.map(mapActivity)
}
