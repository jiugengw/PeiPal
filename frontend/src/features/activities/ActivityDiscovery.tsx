import { useActivityWorkflow } from "@/features/activities/activityWorkflowContext";
import { LocationSearchForm } from "@/features/activities/LocationSearchForm";
import { ActivityResultsList } from "@/features/activities/ActivityResultsList";
import { SelectedActivityPanel } from "@/features/activities/SelectedActivityPanel";
import { PlanConfirmationPanel } from "@/features/plans/PlanConfirmationPanel";
import { useSetupProgress } from "@/features/setup/useSetupProgress";
import styles from "@/features/activities/ActivityDiscovery.module.css";

export function ActivityDiscovery() {
  const { family, olderAdult } = useSetupProgress();
  const {
    location,
    activities,
    selectedActivity,
    unavailableNotice,
    isReviewingPlan,
    activitiesQuery,
    searchActivities,
    selectActivity,
    clearSelection,
    setIsReviewingPlan,
    markSelectionUnavailable,
  } = useActivityWorkflow();

  const greetingName = olderAdult?.preferred_name || olderAdult?.name;

  return (
    <section className={`${styles.discovery} min-h-full bg-[linear-gradient(105deg,var(--muted)_0%,var(--background)_72%)] px-5 py-8 sm:px-8 lg:px-12 lg:py-12`}>
      <div className={`${styles.layout} mx-auto w-full max-w-[1180px]`}>
        <div className="min-w-0">
          <header className="mb-6">
            <h1 className="max-w-[16ch] text-4xl font-bold leading-[0.98] tracking-[-0.035em] text-balance text-foreground sm:text-5xl">
              {greetingName
                ? `Hello, ${greetingName}!`
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
            onSearch={searchActivities}
          />

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
              onClearLocation={() => searchActivities("")}
              onSelect={selectActivity}
              query={activitiesQuery}
              selectedDedupeKey={selectedActivity?.dedupeKey ?? null}
            />
          </div>
        </div>

        <aside className={styles.details}>
          {isReviewingPlan && selectedActivity && family && olderAdult ? (
            <PlanConfirmationPanel
              activity={selectedActivity}
              family={family}
              olderAdult={olderAdult}
              onBack={() => setIsReviewingPlan(false)}
              onUnavailable={markSelectionUnavailable}
            />
          ) : (
            <SelectedActivityPanel
              activity={selectedActivity}
              canMakePlan={Boolean(family && olderAdult)}
              onClear={clearSelection}
              onMakePlan={() => setIsReviewingPlan(true)}
            />
          )}
        </aside>
      </div>
    </section>
  );
}
