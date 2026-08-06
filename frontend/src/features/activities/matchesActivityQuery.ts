import type { Activity } from '@/features/activities/types'

/**
 * The backend's `/api/activities` endpoint only filters by `location`, so it
 * cannot answer "does the activity's name contain this text". Matching by
 * name, venue, and tags therefore happens here, against whatever page of
 * activities is currently loaded.
 */
export function matchesActivityQuery(activity: Pick<Activity, 'title' | 'venue' | 'tags'>, query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true

  return (
    activity.title.toLowerCase().includes(needle) ||
    activity.venue.toLowerCase().includes(needle) ||
    activity.tags.some((tag) => tag.toLowerCase().includes(needle))
  )
}
