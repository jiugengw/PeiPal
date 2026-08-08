import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useStagedCommit, useStagedIntent } from "@/hooks/useStagedIntent";
import { toActivity } from "@/features/activities/api/toActivity";
import {
  formatActivityCost,
  formatActivityWhen,
} from "@/features/activities/format";
import {
  primaryButtonClass,
  secondaryButtonClass,
} from "@/features/activities/activityStyles";
import {
  activityDetailQueryOptions,
  planQueryKey,
  planQueryOptions,
  PlanRequestError,
  plansQueryKey,
  updatePlanStatus,
  type PlanStatus,
} from "@/features/plans/api/planQueries";
import { planStatusLabels } from "@/features/plans/status";
import { CoordinationProgress } from "@/features/coordination/CoordinationProgress";
import { useSetupProgress } from "@/features/setup/useSetupProgress";

export function PlanDetail({ planId }: { planId: number }) {
  const queryClient = useQueryClient();
  const { olderAdult } = useSetupProgress();
  const hasValidPlanId = Number.isInteger(planId) && planId > 0;
  const planQuery = useQuery({
    ...planQueryOptions(planId),
    enabled: hasValidPlanId,
  });
  const plan = planQuery.data;
  const activityQuery = useQuery({
    ...activityDetailQueryOptions(plan?.activity_id ?? 0),
    enabled: Boolean(plan),
  });
  /** Which status change is currently showing its confirm block, if any. */
  const [confirmingStatus, setConfirmingStatus] =
    useState<PlanStatusChange>();
  const [updateNotice, setUpdateNotice] = useState("");

  const updateMutation = useMutation({
    mutationFn: () => updatePlanStatus(planId, "cancelled"),
    onSuccess: (updatedPlan) => {
      queryClient.setQueryData(planQueryKey(planId), updatedPlan);
      void queryClient.invalidateQueries({
        queryKey: plansQueryKey(updatedPlan.family_id),
      });
      setConfirmingStatus(undefined);
      setUpdateNotice("The plan has been cancelled.");
    },
    onError: (error) => {
      if (error instanceof PlanRequestError && error.status === 409) {
        void queryClient.invalidateQueries({ queryKey: planQueryKey(planId) });
        setUpdateNotice("The plan changed elsewhere. We refreshed it so you can review the latest status.");
      }
    },
  });

  const staged = useStagedIntent(
    "confirm_plan_status",
    (intent) => intent.planId === planId,
  );

  const [appliedIntentId, setAppliedIntentId] = useState<string>();

  // Applied once per staged intent, so the person still decides by pressing the
  // same button they would have pressed themselves.
  if (staged && staged.id !== appliedIntentId) {
    setAppliedIntentId(staged.id);
    setUpdateNotice("");
    setConfirmingStatus("cancelled");
  }

  useStagedCommit(Boolean(staged) && Boolean(confirmingStatus), () => {
    if (confirmingStatus) updateMutation.mutate();
  });

  if (!hasValidPlanId) {
    return <PlanPageMessage title="That plan link is not valid." action="Return to discovery" />;
  }

  if (planQuery.isPending) {
    return <PlanPageMessage title="Loading your plan…" status />;
  }

  if (planQuery.isError || !plan) {
    return (
      <PlanPageMessage
        title={planQuery.error instanceof PlanRequestError && planQuery.error.status === 404 ? "That plan is no longer available." : "We could not load this plan."}
        action="Try again"
        onAction={() => void planQuery.refetch()}
      />
    );
  }

  const activity = activityQuery.data ? toActivity(activityQuery.data) : null;
  const olderAdultName = olderAdult?.preferred_name || olderAdult?.name || "your family member";
  const isActive = plan.status !== "cancelled" && plan.status !== "rejected" && plan.status !== "completed";

  return (
    <section className="min-h-full bg-[linear-gradient(105deg,var(--muted)_0%,var(--background)_72%)] px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
      <div className="mx-auto grid w-full max-w-[1080px] gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-12">
        <div className="min-w-0">
          <header>
            <h1 className="max-w-[16ch] text-4xl font-bold leading-[0.98] tracking-[-0.035em] text-balance text-foreground sm:text-5xl">
              A plan for {olderAdultName}.
            </h1>
            <p className="mt-4 max-w-[65ch] text-lg leading-relaxed text-foreground">
              Review what has been saved and choose the next clear step. Asking for approval emails the whole family at once.
            </p>
          </header>

          <div className="mt-8 border-y border-border bg-background px-5 py-2 sm:px-7">
            {activityQuery.isPending ? (
              <p className="py-6 text-lg font-bold text-foreground" role="status">Loading activity details…</p>
            ) : activityQuery.isError || !activity ? (
              <div className="py-6" role="alert">
                <p className="font-bold text-foreground">We could not load the activity details for this plan.</p>
                <button className={`${secondaryButtonClass} mt-3`} onClick={() => void activityQuery.refetch()} type="button">Try activity again</button>
              </div>
            ) : (
              <>
                <h2 className="py-5 text-2xl font-bold text-foreground">{activity.title}</h2>
                <dl className="divide-y divide-border border-t border-border text-base text-foreground">
                  <PlanRow label="When" value={formatActivityWhen(activity)} />
                  <PlanRow label="Where" value={activity.venue} />
                  <PlanRow label="Cost" value={formatActivityCost(activity)} />
                </dl>
                {activity.description ? <p className="py-5 text-base leading-relaxed text-foreground">{activity.description}</p> : null}
              </>
            )}
          </div>
          <CoordinationProgress planId={plan.id} planStatus={plan.status} />
        </div>

        <aside className="lg:sticky lg:top-8 lg:self-start">
          <div className="rounded-2xl bg-background p-6 shadow-[0_18px_45px_rgb(37_44_64_/_0.10)]">
            <h2 className="text-xl font-bold text-foreground">{planStatusLabels[plan.status]}</h2>
            <p className="mt-2 text-base leading-relaxed text-foreground">{statusExplanation(plan.status)}</p>

            {updateNotice ? <p className="mt-4 rounded-xl bg-muted p-4 font-bold text-foreground" role="status">{updateNotice}</p> : null}
            {updateMutation.error && !(updateMutation.error instanceof PlanRequestError && updateMutation.error.status === 409) ? (
              <p className="mt-4 font-bold text-foreground" role="alert">{updateMutation.error.message}</p>
            ) : null}

            {isActive && !confirmingStatus ? (
              <button className={`${secondaryButtonClass} mt-3 w-full`} disabled={updateMutation.isPending} onClick={() => setConfirmingStatus("cancelled")} type="button">Cancel plan</button>
            ) : null}

            {confirmingStatus === "cancelled" ? (
              <div className="mt-5 rounded-xl bg-muted p-4">
                <h3 className="font-bold text-foreground">Cancel this plan?</h3>
                <p className="mt-1 text-base leading-relaxed text-foreground">The plan will remain visible as cancelled, and no further sharing should happen.</p>
                <div className="mt-4 space-y-2">
                  <button className={`${primaryButtonClass} w-full`} disabled={updateMutation.isPending} onClick={() => updateMutation.mutate()} type="button">{updateMutation.isPending ? "Cancelling…" : "Confirm cancellation"}</button>
                  <button className={`${secondaryButtonClass} w-full`} disabled={updateMutation.isPending} onClick={() => setConfirmingStatus(undefined)} type="button">Keep plan</button>
                </div>
              </div>
            ) : null}

            <Link className={`${secondaryButtonClass} mt-3 w-full no-underline`} to="/discover">Back to activities</Link>
          </div>
        </aside>
      </div>
    </section>
  );
}

/** The only status change the plan owner makes directly. */
type PlanStatusChange = "cancelled";

function PlanRow({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-4 py-4"><dt className="font-bold">{label}</dt><dd className="text-right">{value}</dd></div>;
}

function statusExplanation(status: PlanStatus) {
  if (status === "draft")
    return "Nothing has been sent yet. Ask your family when the details feel right.";
  if (status === "coordinating")
    return "Your whole family has been asked. The first person to answer decides for everyone.";
  if (status === "ready")
    return "Everything is arranged. Tell us afterwards how it went.";
  if (status === "completed") return "This activity is done.";
  if (status === "rejected")
    return "Your family decided against this one, and nothing further will be sent.";
  return "This plan is no longer active and no further action will be taken.";
}

function PlanPageMessage({ title, action, onAction, status = false }: { title: string; action?: string; onAction?: () => void; status?: boolean }) {
  return (
    <section className="grid min-h-full place-items-center px-6 py-12 text-center">
      <div>
        <h1 className="text-3xl font-bold text-foreground" {...(status ? { role: "status" } : {})}>{title}</h1>
        {action ? onAction ? (
          <button className={`${primaryButtonClass} mt-5`} onClick={onAction} type="button">{action}</button>
        ) : (
          <Link className={`${primaryButtonClass} mt-5 no-underline`} to="/discover">{action}</Link>
        ) : null}
      </div>
    </section>
  );
}
