import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "motion/react";
import { describeTask } from "@/features/coordination/describeTask";
import {
  askTheFamily,
  markPlanDone,
  planCoordinationQueryKey,
  planCoordinationQueryOptions,
} from "@/features/coordination/api/planCoordinationQueries";
import { planQueryKey } from "@/features/plans/api/planQueries";

const primaryButtonClass =
  "inline-flex min-h-14 items-center justify-center rounded-xl bg-primary px-6 font-extrabold text-primary-foreground hover:bg-foreground disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClass =
  "inline-flex min-h-14 items-center justify-center rounded-xl border border-input bg-background px-6 font-extrabold text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50";

const TASK_LABELS = {
  approval: "Approval",
  registration: "Signing up",
  transport: "Getting there",
} as const;

const TASK_COMPLETE = {
  approval: (status: string) => status === "approved",
  registration: (status: string) => status === "done" || status === "not_needed",
  transport: (status: string) => status === "done" || status === "not_needed",
} as const;

/** What the older adult sees after asking: who did what, and what is left. */
export function CoordinationProgress({
  planId,
  planStatus,
}: {
  planId: number;
  planStatus: string;
}) {
  const queryClient = useQueryClient();
  const hasAsked = planStatus !== "draft";
  const stateQuery = useQuery({
    ...planCoordinationQueryOptions(planId),
    enabled: hasAsked,
  });

  const ask = useMutation({
    mutationFn: () => askTheFamily(planId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: planQueryKey(planId) });
      void queryClient.invalidateQueries({
        queryKey: planCoordinationQueryKey(planId),
      });
    },
  });
  const markDone = useMutation({
    mutationFn: () => markPlanDone(planId),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: planQueryKey(planId) }),
  });

  if (!hasAsked) {
    return (
      <section className="mt-10 rounded-2xl bg-background p-6 shadow-[0_18px_45px_rgb(37_44_64_/_0.10)]">
        <h2 className="text-2xl font-bold text-foreground">Your family has not been asked yet</h2>
        <p className="mt-2 max-w-[65ch] text-lg leading-relaxed text-foreground">
          We could not email anyone when this plan was made. Try again, and
          everyone in your family will be asked at once.
        </p>
        <button
          className={`${primaryButtonClass} mt-5 w-full sm:w-auto`}
          disabled={ask.isPending}
          onClick={() => ask.mutate()}
          type="button"
        >
          {ask.isPending ? "Asking…" : "Ask my family now"}
        </button>
        {ask.data ? (
          <p
            className="mt-4 rounded-2xl bg-muted p-5 font-bold text-foreground"
            role="status"
          >
            {ask.data.message}
          </p>
        ) : null}
        {ask.isError ? (
          <p className="mt-4 font-bold text-foreground" role="alert">
            {ask.error.message}
          </p>
        ) : null}
      </section>
    );
  }

  return (
    <section className="mt-10" aria-labelledby="progress-heading">
      <h2
        className="text-2xl font-bold tracking-[-0.025em] text-foreground"
        id="progress-heading"
      >
        How your family is helping
      </h2>

      {ask.data ? (
        <p
          className="mt-3 rounded-2xl bg-muted p-5 font-bold text-foreground"
          role="status"
        >
          {ask.data.message}
        </p>
      ) : null}

      {stateQuery.isPending ? (
        <p className="mt-4 font-bold text-foreground" role="status">
          Checking with your family…
        </p>
      ) : stateQuery.isError ? (
        <div className="mt-4" role="alert">
          <p className="font-bold text-foreground">
            We could not load your family's progress.
          </p>
          <button
            className={`${secondaryButtonClass} mt-3`}
            onClick={() => void stateQuery.refetch()}
            type="button"
          >
            Try again
          </button>
        </div>
      ) : (
        <>
          <ProgressSummary
            planStatus={planStatus}
            tasks={stateQuery.data.tasks ?? []}
          />
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {(stateQuery.data.tasks ?? []).map((task) => (
              <li
                className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between"
                key={task.task_type}
              >
                <span className="text-lg font-bold text-foreground">
                  {TASK_LABELS[task.task_type]}
                </span>
                <span className="text-base text-foreground sm:text-right">
                  {describeTask(task)}
                </span>
              </li>
            ))}
          </ul>

          {planStatus === "ready" ? (
            <div className="mt-6 rounded-2xl bg-muted p-5">
              <p className="text-lg font-bold text-foreground">
                Everything has arranged the plan. Enjoy it!
              </p>
              <button
                className={`${primaryButtonClass} mt-4`}
                disabled={markDone.isPending}
                onClick={() => markDone.mutate()}
                type="button"
              >
                {markDone.isPending ? "Saving…" : "I have went and completed the activity"}
              </button>
            </div>
          ) : null}

          {(stateQuery.data.events ?? []).length > 0 ? (
            <ul className="mt-6 divide-y divide-border border-y border-border">
              {(stateQuery.data.events ?? []).map((event, index) => (
                <li className="py-3 text-base text-foreground" key={index}>
                  <strong>{event.actor_name}</strong> {event.action}
                  {event.task_type ? ` — ${TASK_LABELS[event.task_type]}` : ""}
                </li>
              ))}
            </ul>
          ) : null}

          {ask.isError ? (
            <p className="mt-4 font-bold text-foreground" role="alert">
              {ask.error.message}
            </p>
          ) : null}
          {planStatus === "coordinating" ? (
            <button
              className={`${secondaryButtonClass} mt-5`}
              disabled={ask.isPending}
              onClick={() => ask.mutate()}
              type="button"
            >
              {ask.isPending ? "Sending…" : "Retry any failed emails"}
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}

function ProgressSummary({
  planStatus,
  tasks,
}: {
  planStatus: string;
  tasks: Array<{ task_type: keyof typeof TASK_LABELS; status: string }>;
}) {
  const reduceMotion = useReducedMotion();
  const steps = (Object.keys(TASK_LABELS) as Array<keyof typeof TASK_LABELS>).map(
    (taskType) => {
      const task = tasks.find((item) => item.task_type === taskType);
      const status = task?.status ?? "open";
      const complete = TASK_COMPLETE[taskType](status);
      return { taskType, status, complete };
    },
  );
  const completedCount = steps.filter((step) => step.complete).length;
  const isTerminal = planStatus === "cancelled" || planStatus === "rejected";
  const isComplete = planStatus === "completed" || completedCount === steps.length;
  const value = isComplete ? steps.length : completedCount;

  if (isTerminal) {
    return (
      <div className="mt-6 rounded-2xl border border-border bg-muted p-5">
        <p className="text-lg font-bold text-foreground">
          {planStatus === "cancelled"
            ? "This plan was cancelled."
            : "Your family decided not to continue with this plan."}
        </p>
        <p className="mt-1 text-base leading-relaxed text-foreground">
          No more steps are needed.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-2xl border border-border bg-background p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-xl font-bold text-foreground">Your progress</h3>
        <p className="text-base font-bold text-foreground" aria-live="polite">
          {isComplete ? "Everything is complete" : `${completedCount} of ${steps.length} complete`}
        </p>
      </div>

      <div
        className="mt-5 h-3 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-label="Family coordination progress"
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={value}
        aria-valuetext={`${value} of ${steps.length} coordination steps complete`}
      >
        <motion.div
          className="h-full rounded-full bg-primary"
          initial={reduceMotion ? false : { width: 0 }}
          animate={{ width: `${(value / steps.length) * 100}%` }}
          transition={{ duration: 0.45, ease: "easeOut" }}
        />
      </div>

      <ol className="mt-6 grid grid-cols-3 gap-3" aria-label="Coordination steps">
        {steps.map((step) => (
          <li className="min-w-0" key={step.taskType}>
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-base font-extrabold ${step.complete ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background text-foreground"}`}
              aria-hidden="true"
            >
              {step.complete ? "✓" : ""}
            </div>
            <p className="mt-2 text-sm font-extrabold leading-tight text-foreground sm:text-base">
              {TASK_LABELS[step.taskType]}
            </p>
            <p className="mt-1 text-sm leading-tight text-foreground">
              {step.complete
                ? step.status === "not_needed"
                  ? "Not needed"
                  : "Complete"
                : "Still needed"}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
