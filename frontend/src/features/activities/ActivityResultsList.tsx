import type { UseQueryResult } from "@tanstack/react-query";
import type { components } from "@/generated/api";
import type { Activity } from "@/features/activities/types";
import { ActivityListItem } from "@/features/activities/ActivityListItem";
import {
  primaryButtonClass,
  secondaryButtonClass,
} from "@/features/activities/activityStyles";

type ActivityListResponse = components["schemas"]["ActivityListResponse"];

interface ActivityResultsListProps {
  query: UseQueryResult<ActivityListResponse, unknown>;
  activities: Activity[];
  locationFilter: string;
  selectedDedupeKey: string | null;
  onSelect: (activity: Activity) => void;
  onClearLocation: () => void;
}

export function ActivityResultsList({
  query,
  activities,
  locationFilter,
  selectedDedupeKey,
  onSelect,
  onClearLocation,
}: ActivityResultsListProps) {
  if (query.isPending) return <ActivityResultsSkeleton />;

  if (query.isError) {
    return (
      <div
        className="rounded-2xl border border-input bg-background p-6"
        role="alert"
      >
        <p className="text-lg font-bold text-foreground">
          We could not load activities.
        </p>
        <p className="mt-2 text-base text-foreground">
          Check your connection and try again.
        </p>
        <button
          className={`${primaryButtonClass} mt-5`}
          onClick={() => void query.refetch()}
          type="button"
        >
          Try again
        </button>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="rounded-2xl bg-muted p-6">
        <p className="text-lg font-bold text-foreground">
          {locationFilter
            ? `No activities found near "${locationFilter}" right now.`
            : "No activities are available right now."}
        </p>
        <p className="mt-2 text-base text-foreground">
          {locationFilter
            ? "Try clearing the location to see everything nearby."
            : "Check back again soon."}
        </p>
        {locationFilter ? (
          <button
            className={`${secondaryButtonClass} mt-5`}
            onClick={onClearLocation}
            type="button"
          >
            Clear location filter
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <ul
      aria-live="polite"
      className="divide-y divide-border border-y border-border"
    >
      {activities.map((activity) => (
        <ActivityListItem
          activity={activity}
          isSelected={activity.dedupeKey === selectedDedupeKey}
          key={activity.dedupeKey}
          onSelect={onSelect}
        />
      ))}
    </ul>
  );
}

function ActivityResultsSkeleton() {
  return (
    <div>
      <p className="sr-only" role="status">
        Loading activities…
      </p>
      <ul
        aria-hidden="true"
        className="divide-y divide-border border-y border-border"
      >
        {[0, 1, 2].map((row) => (
          <li className="animate-pulse py-6" key={row}>
            <div className="h-6 w-2/3 rounded bg-muted" />
            <div className="mt-3 h-4 w-1/3 rounded bg-muted" />
            <div className="mt-4 h-4 w-full rounded bg-muted" />
            <div className="mt-2 h-4 w-5/6 rounded bg-muted" />
          </li>
        ))}
      </ul>
    </div>
  );
}
