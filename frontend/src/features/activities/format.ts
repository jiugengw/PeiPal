import type { Activity } from '@/features/activities/types'

const dateFormatter = new Intl.DateTimeFormat(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' })

/** Human-facing date and time for an activity, or a plain notice when it is not yet confirmed. */
export function formatActivityWhen(activity: Pick<Activity, 'startsAt' | 'endsAt'>): string {
  if (!activity.startsAt) return 'Time to be confirmed'

  const datePart = dateFormatter.format(activity.startsAt)
  const startTime = timeFormatter.format(activity.startsAt)

  if (activity.endsAt) {
    const endTime = timeFormatter.format(activity.endsAt)
    return `${datePart} · ${startTime}–${endTime}`
  }

  return `${datePart} · ${startTime}`
}

/** Human-facing cost for an activity. Missing cost is "unavailable", never treated as free. */
export function formatActivityCost(activity: Pick<Activity, 'cost' | 'currency' | 'priceRemarks'>): string {
  if (activity.cost === null || activity.cost === undefined) return 'Price unavailable'

  const base = activity.cost === 0 ? 'Free' : formatCurrencyAmount(activity.cost, activity.currency)
  return activity.priceRemarks ? `${base} · ${activity.priceRemarks}` : base
}

function formatCurrencyAmount(cost: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'SGD' }).format(cost)
  } catch {
    return currency ? `${currency} ${cost.toFixed(2)}` : cost.toFixed(2)
  }
}
