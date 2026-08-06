import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  activitiesQueryOptions,
  DEFAULT_ACTIVITY_RESULTS_LIMIT,
} from "@/features/activities/api/activityQueries";
import { toActivity } from "@/features/activities/api/toActivity";
import type { Activity } from "@/features/activities/types";
import { LocationSearchForm } from "@/features/activities/LocationSearchForm";
import { ActivityResultsList } from "@/features/activities/ActivityResultsList";
import { SelectedActivityPanel } from "@/features/activities/SelectedActivityPanel";
import { useSetupProgress } from "@/features/setup/useSetupProgress";

export function ActivityDiscovery() {
  const { olderAdult } = useSetupProgress();
  const [location, setLocation] = useState("");
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(
    null,
  );
  const [unavailableNotice, setUnavailableNotice] = useState("");

  const activitiesQuery = useQuery(
    activitiesQueryOptions({ location, limit: DEFAULT_ACTIVITY_RESULTS_LIMIT }),
  );
  const activities = (activitiesQuery.data?.activities ?? []).map(toActivity);

  // Keep the selection honest: if a refreshed result set no longer contains the
  // chosen activity, drop the selection and say so rather than letting someone
  // continue toward a plan for something that is no longer there.
  useEffect(() => {
    if (
      !selectedActivity ||
      activitiesQuery.isPending ||
      activitiesQuery.isError
    )
      return;

    const rows = activitiesQuery.data?.activities ?? [];
    const stillAvailable = rows.some(
      (row) => row.dedupe_key === selectedActivity.dedupeKey,
    );
    if (!stillAvailable) {
      setSelectedActivity(null);
      setUnavailableNotice(
        "That activity is no longer available. Choose another one below.",
      );
    }
  }, [
    activitiesQuery.data,
    activitiesQuery.isError,
    activitiesQuery.isPending,
    selectedActivity,
  ]);

  function selectActivity(activity: Activity) {
    setUnavailableNotice("");
    setSelectedActivity(activity);
  }

  function clearSelection() {
    setSelectedActivity(null);
  }

  function searchLocation(nextLocation: string) {
    setUnavailableNotice("");
    setLocation(nextLocation);
  }

  const greetingName = olderAdult?.preferred_name || olderAdult?.name;

  return (
    <section className="min-h-full bg-[linear-gradient(105deg,var(--muted)_0%,var(--background)_72%)] px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
      <div className="mx-auto grid w-full max-w-[1180px] gap-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-10">
        <div className="min-w-0">
          <header className="mb-6">
            <h1 className="max-w-[16ch] text-4xl font-bold leading-[0.98] tracking-[-0.035em] text-balance text-foreground sm:text-5xl">
              {greetingName
                ? `Something new for ${greetingName}?`
                : "Find something to look forward to."}
            </h1>
            <p className="mt-4 max-w-[65ch] text-lg leading-relaxed text-foreground">
              Browse nearby activities, or search a neighborhood to narrow
              things down. Choose one to see the full details.
            </p>
          </header>

          <LocationSearchForm location={location} onSearch={searchLocation} />

          {unavailableNotice ? (
            <p
              className="mt-6 rounded-xl border border-input bg-background p-4 text-base font-bold text-foreground"
              role="alert"
            >
              {unavailableNotice}
            </p>
          ) : null}

          <div className="mt-6">
            <ActivityResultsList
              activities={activities}
              locationFilter={location}
              onClearLocation={() => searchLocation("")}
              onSelect={selectActivity}
              query={activitiesQuery}
              selectedDedupeKey={selectedActivity?.dedupeKey ?? null}
            />
          </div>
        </div>

        <aside className="lg:sticky lg:top-8 lg:self-start">
          <SelectedActivityPanel
            activity={selectedActivity}
            onClear={clearSelection}
          />
        </aside>
      </div>
    </section>
  );
}
