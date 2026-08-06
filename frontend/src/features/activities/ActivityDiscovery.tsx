import { useState } from "react";
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
import { PlanConfirmationPanel } from "@/features/plans/PlanConfirmationPanel";
import { useSetupProgress } from "@/features/setup/useSetupProgress";

export function ActivityDiscovery() {
  const { household, olderAdult } = useSetupProgress();
  const [location, setLocation] = useState("");
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(
    null,
  );
  const [unavailableNotice, setUnavailableNotice] = useState("");
  const [isReviewingPlan, setIsReviewingPlan] = useState(false);

  const activitiesQuery = useQuery(
    activitiesQueryOptions({ location, limit: DEFAULT_ACTIVITY_RESULTS_LIMIT }),
  );
  const activities = (activitiesQuery.data?.activities ?? []).map(toActivity);
  const selectionUnavailable = Boolean(
    selectedActivity &&
      !activitiesQuery.isPending &&
      !activitiesQuery.isError &&
      !(activitiesQuery.data?.activities ?? []).some(
        (row) => row.dedupe_key === selectedActivity.dedupeKey,
      ),
  );
  const visibleSelection = selectionUnavailable ? null : selectedActivity;
  const visibleUnavailableNotice = selectionUnavailable
    ? "That activity is no longer available. Choose another one below."
    : unavailableNotice;

  function selectActivity(activity: Activity) {
    setUnavailableNotice("");
    setSelectedActivity(activity);
    setIsReviewingPlan(false);
  }

  function clearSelection() {
    setSelectedActivity(null);
    setIsReviewingPlan(false);
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

          <LocationSearchForm
            key={location}
            location={location}
            onSearch={searchLocation}
          />

          {visibleUnavailableNotice ? (
            <p
              className="mt-6 rounded-xl border border-input bg-background p-4 text-base font-bold text-foreground"
              role="alert"
            >
              {visibleUnavailableNotice}
            </p>
          ) : null}

          <div className="mt-6">
            <ActivityResultsList
              activities={activities}
              locationFilter={location}
              onClearLocation={() => searchLocation("")}
              onSelect={selectActivity}
              query={activitiesQuery}
              selectedDedupeKey={visibleSelection?.dedupeKey ?? null}
            />
          </div>
        </div>

        <aside className="lg:sticky lg:top-8 lg:self-start">
          {isReviewingPlan && visibleSelection && household && olderAdult ? (
            <PlanConfirmationPanel
              activity={visibleSelection}
              household={household}
              olderAdult={olderAdult}
              onBack={() => setIsReviewingPlan(false)}
              onUnavailable={() => {
                clearSelection();
                setUnavailableNotice(
                  "That activity is no longer available. Choose another one below.",
                );
              }}
            />
          ) : (
            <SelectedActivityPanel
              activity={visibleSelection}
              canMakePlan={Boolean(household && olderAdult)}
              onClear={clearSelection}
              onMakePlan={() => setIsReviewingPlan(true)}
            />
          )}
        </aside>
      </div>
    </section>
  );
}
