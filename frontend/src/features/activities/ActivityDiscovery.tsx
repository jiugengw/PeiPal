import { useActivityWorkflow } from "@/features/activities/activityWorkflowContext";
import { LocationSearchForm } from "@/features/activities/LocationSearchForm";
import { ActivityResultsList } from "@/features/activities/ActivityResultsList";
import { SelectedActivityPanel } from "@/features/activities/SelectedActivityPanel";
import { PlanConfirmationPanel } from "@/features/plans/PlanConfirmationPanel";
import { useViewer } from "@/hooks/useViewer";

export function ActivityDiscovery() {
  // This page is reachable by older-adult accounts only (see roleAccess.ts) -
  // useSetupProgress is the organizer's own view of a family it owns, which
  // is always empty for the older adult signed in here. useViewer resolves
  // whoever is actually signed in, regardless of role.
  const viewer = useViewer();
  const canMakePlan = Boolean(viewer.familyId && viewer.olderAdultId);
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

  const greetingName = viewer.displayName;

  return (
    <section className="min-h-full bg-[linear-gradient(105deg,var(--muted)_0%,var(--background)_72%)] px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
      <div className="mx-auto w-full max-w-[1100px]">
        <header className="mb-6">
          <h1 className="max-w-[16ch] text-4xl font-bold leading-[0.98] tracking-[-0.035em] text-balance text-foreground sm:text-5xl">
            {greetingName
              ? `Hello, ${greetingName}!`
              : "Find something to look forward to."}
          </h1>
          <p className="mt-4 max-w-[65ch] text-lg leading-relaxed text-foreground">
            Browse nearby activities, or search a neighborhood to narrow things
            down. Choose one to see the full details.
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
            selectedContent={
              selectedActivity ? (
                isReviewingPlan && viewer.familyId && viewer.olderAdultId ? (
                  <PlanConfirmationPanel
                    activity={selectedActivity}
                    family={{ id: viewer.familyId }}
                    olderAdult={{
                      id: viewer.olderAdultId,
                      name: viewer.displayName ?? "",
                      preferred_name: viewer.displayName ?? null,
                    }}
                    onBack={() => setIsReviewingPlan(false)}
                    onUnavailable={markSelectionUnavailable}
                    variant="inline"
                  />
                ) : (
                  <SelectedActivityPanel
                    activity={selectedActivity}
                    canMakePlan={canMakePlan}
                    onClear={clearSelection}
                    onMakePlan={() => setIsReviewingPlan(true)}
                  />
                )
              ) : undefined
            }
          />
        </div>
      </div>
    </section>
  );
}
