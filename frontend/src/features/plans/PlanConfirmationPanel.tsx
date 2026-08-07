import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import type { components } from "@/generated/api";
import type { Activity } from "@/features/activities/types";
import { formatActivityWhen } from "@/features/activities/format";
import {
  primaryButtonClass,
  secondaryButtonClass,
} from "@/features/activities/activityStyles";
import {
  createPlan,
  PlanRequestError,
  planQueryKey,
} from "@/features/plans/api/planQueries";
import { useStagedCommit, useStagedIntent } from "@/hooks/useStagedIntent";

interface PlanConfirmationPanelProps {
  activity: Activity;
  family: components["schemas"]["FamilyResponse"];
  olderAdult: components["schemas"]["OlderAdultResponse"];
  onBack: () => void;
  onUnavailable: () => void;
}

export function PlanConfirmationPanel({
  activity,
  family,
  olderAdult,
  onBack,
  onUnavailable,
}: PlanConfirmationPanelProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createMutation = useMutation({
    mutationFn: () =>
      createPlan({
        family_id: family.id,
        older_adult_id: olderAdult.id,
        activity_id: activity.databaseId,
      }),
    onSuccess: async (plan) => {
      queryClient.setQueryData(planQueryKey(plan.id), plan);
      await navigate({
        to: "/plans/$planId",
        params: { planId: String(plan.id) },
      });
    },
  });

  const error = createMutation.error;
  const unavailable =
    error instanceof PlanRequestError && error.status === 404;

  // The review block is already on screen whenever this panel renders, so the
  // companion only needs the button's handler.
  const staged = useStagedIntent("review_plan");
  useStagedCommit(Boolean(staged) && !unavailable, () =>
    createMutation.mutate(),
  );
  const olderAdultName = olderAdult.preferred_name || olderAdult.name;
  const sharingDescription =
    olderAdult.sharing_mode === "direct"
      ? "The plan will be shared after this confirmation. No separate family approval is required."
      : "This creates a private draft. You can then ask the family to review it before anything is shared.";

  return (
    <div className="rounded-2xl bg-background p-6 shadow-[0_18px_45px_rgb(37_44_64_/_0.10)]">
      <h2 className="text-2xl font-bold text-foreground">Review this plan</h2>
      <p className="mt-2 text-base leading-relaxed text-foreground">
        Check the details before creating it. No email is sent at this stage.
      </p>

      <dl className="mt-6 divide-y divide-border border-y border-border text-base text-foreground">
        <PlanDetail label="For" value={olderAdultName} />
        <PlanDetail label="Activity" value={activity.title} />
        <PlanDetail label="When" value={formatActivityWhen(activity)} />
        <PlanDetail label="Where" value={activity.venue} />
      </dl>

      <div className="mt-5 rounded-xl bg-muted p-4">
        <h3 className="font-bold text-foreground">What happens next</h3>
        <p className="mt-1 text-base leading-relaxed text-foreground">
          {sharingDescription}
        </p>
      </div>

      {error ? (
        <div className="mt-5" role="alert">
          <p className="font-bold text-foreground">{error.message}</p>
          {unavailable ? (
            <button
              className={`${secondaryButtonClass} mt-3 w-full`}
              onClick={onUnavailable}
              type="button"
            >
              Return to activities
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6 space-y-3">
        <button
          className={`${primaryButtonClass} w-full`}
          disabled={createMutation.isPending || unavailable}
          onClick={() => createMutation.mutate()}
          type="button"
        >
          {createMutation.isPending ? "Creating plan…" : "Confirm and create plan"}
        </button>
        <button
          className={`${secondaryButtonClass} w-full`}
          disabled={createMutation.isPending}
          onClick={onBack}
          type="button"
        >
          Back to activity
        </button>
      </div>
    </div>
  );
}

function PlanDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-3">
      <dt className="font-bold">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
