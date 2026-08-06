import { useState } from 'react'
import type { Activity } from '@/features/activities/types'
import { formatActivityCost, formatActivityWhen } from '@/features/activities/format'
import { compactButtonClass, compactPrimaryButtonClass } from '@/features/activities/activityStyles'

interface ActivityListItemProps {
  activity: Activity
  isSelected: boolean
  onSelect: (activity: Activity) => void
}

export function ActivityListItem({ activity, isSelected, onSelect }: ActivityListItemProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <li className="py-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-xl font-bold text-foreground">{activity.title}</h3>
            {isSelected ? (
              <span className="inline-flex min-h-7 items-center rounded-full bg-accent px-3 text-sm font-extrabold text-foreground">
                Selected
              </span>
            ) : null}
          </div>

          <p className="mt-2 text-base text-foreground">
            {formatActivityWhen(activity)} · {activity.venue} · {formatActivityCost(activity)}
          </p>

          {activity.tags.length ? (
            <ul className="mt-3 flex flex-wrap gap-2">
              {activity.tags.map((tag) => (
                <li className="rounded-[7px] border border-border bg-background px-2 py-1 text-sm font-bold text-foreground" key={tag}>
                  {tag}
                </li>
              ))}
            </ul>
          ) : null}

          {isExpanded ? (
            <div className="mt-4 max-w-[65ch] text-base leading-relaxed text-foreground">
              <p>{activity.description || 'No further description is available yet.'}</p>
              {activity.mobilityNotes ? (
                <p className="mt-2">
                  <strong>Mobility:</strong> {activity.mobilityNotes}
                </p>
              ) : null}
              {activity.slotsAvailability ? (
                <p className="mt-2">
                  <strong>Availability:</strong> {activity.slotsAvailability}
                </p>
              ) : null}
              {activity.infoLink ? (
                <p className="mt-3">
                  <a
                    className="font-bold text-primary underline"
                    href={activity.infoLink}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    More information (opens in a new tab)
                  </a>
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex flex-none flex-wrap gap-3">
          <button
            aria-expanded={isExpanded}
            className={compactButtonClass}
            onClick={() => setIsExpanded((value) => !value)}
            type="button"
          >
            {isExpanded ? 'Show less' : 'Tell me more'}
          </button>
          <button
            className={compactPrimaryButtonClass}
            disabled={isSelected}
            onClick={() => onSelect(activity)}
            type="button"
          >
            {isSelected ? 'Selected' : 'Choose this activity'}
          </button>
        </div>
      </div>
    </li>
  )
}
