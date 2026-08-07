import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useStagedCommit, useStagedIntent } from "@/hooks/useStagedIntent";
import { toActivity } from "@/features/activities/api/toActivity";
import { formatActivityWhen } from "@/features/activities/format";
import {
  primaryButtonClass,
  secondaryButtonClass,
} from "@/features/activities/activityStyles";
import {
  activityDetailQueryOptions,
  planQueryKey,
  plansQueryKey,
  updatePlanStatus,
  type Plan,
} from "@/features/plans/api/planQueries";
import { planStatusLabels } from "@/features/plans/status";

/** Plain language for a settled plan. */
function planSummary(plan: Plan) {
  if (plan.status === "rejected") return "Your family decided against this one.";
  if (plan.status === "completed") return "This activity is done.";
  return "Everything is arranged.";
}

export function FamilyPlanRow({
  plan,
  olderAdultName,
}: {
  plan: Plan;
  olderAdultName: string;
}) {
  const queryClient = useQueryClient();
  const [pendingAction, setPendingAction] = useState<"cancelled">();
  const [notice, setNotice] = useState("");
  const activityQuery = useQuery(activityDetailQueryOptions(plan.activity_id));
  const updateMutation = useMutation({
    mutationFn: (status: "cancelled") =>
      updatePlanStatus(plan.id, status),
    onSuccess: (updated) => {
      queryClient.setQueryData(planQueryKey(plan.id), updated);
      void queryClient.invalidateQueries({ queryKey: plansQueryKey(plan.family_id) });
      setNotice("The plan was cancelled.");
      setPendingAction(undefined);
    },
    onError: () => void queryClient.invalidateQueries({ queryKey: plansQueryKey(plan.family_id) }),
  });
  const staged = useStagedIntent(
    "confirm_plan_status",
    (intent) => intent.planId === plan.id,
  );

  const [appliedIntentId, setAppliedIntentId] = useState<string>();

  // Applied once per staged intent; this row's own buttons keep working.
  if (staged && staged.id !== appliedIntentId) {
    setAppliedIntentId(staged.id);
    if (plan.status === "coordinating") {
      setNotice("");
      setPendingAction("cancelled");
    }
  }

  useStagedCommit(Boolean(staged) && Boolean(pendingAction), () => {
    if (pendingAction) updateMutation.mutate(pendingAction);
  });

  const activity = activityQuery.data ? toActivity(activityQuery.data) : null;

  return (
    <article className="border-t border-border py-7 first:border-t-0">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start">
        <div className="min-w-0">
          <p className="text-base font-bold text-foreground">{olderAdultName} · {planStatusLabels[plan.status]}</p>
          {activityQuery.isPending ? <p className="mt-2 text-lg font-bold text-foreground" role="status">Loading activity…</p> : activityQuery.isError || !activity ? <p className="mt-2 font-bold text-foreground" role="alert">Activity details are unavailable.</p> : (
            <>
              <h3 className="mt-2 text-2xl font-bold tracking-[-0.025em] text-foreground">{activity.title}</h3>
              <p className="mt-2 text-lg leading-relaxed text-foreground">{formatActivityWhen(activity)} · {activity.venue}</p>
            </>
          )}
          {plan.status === "coordinating" ? <p className="mt-3 text-base leading-relaxed text-foreground">Every family member has been emailed their own link. The first person to answer decides for everyone.</p> : null}
          {plan.status === "ready" || plan.status === "rejected" || plan.status === "completed" ? <p className="mt-3 text-base leading-relaxed text-foreground">{planSummary(plan)}</p> : null}
        </div>
        <div className="flex flex-col gap-2">
          <Link className={`${secondaryButtonClass} w-full no-underline`} to="/plans/$planId" params={{ planId: String(plan.id) }}>Open plan</Link>
          {plan.status === "coordinating" || plan.status === "ready" ? <button className={`${secondaryButtonClass} w-full`} disabled={updateMutation.isPending} onClick={() => setPendingAction("cancelled")} type="button">Cancel plan</button> : null}
        </div>
      </div>

      {pendingAction ? (
        <div className="mt-5 rounded-2xl bg-muted p-5">
          <h4 className="text-lg font-bold text-foreground">"Cancel this plan?"</h4>
          <p className="mt-1 text-base leading-relaxed text-foreground">"The plan will remain visible as cancelled, and your family will see that it was stopped."</p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button className={primaryButtonClass} disabled={updateMutation.isPending} onClick={() => updateMutation.mutate(pendingAction)} type="button">{updateMutation.isPending ? "Updating…" : "Confirm cancellation"}</button>
            <button className={secondaryButtonClass} disabled={updateMutation.isPending} onClick={() => setPendingAction(undefined)} type="button">Go back</button>
          </div>
        </div>
      ) : null}
      {notice ? <p className="mt-4 rounded-xl bg-muted p-4 font-bold text-foreground" role="status">{notice}</p> : null}
      {updateMutation.isError ? <p className="mt-4 font-bold text-foreground" role="alert">The plan changed or could not be updated. The list is refreshing.</p> : null}
    </article>
  );
}
