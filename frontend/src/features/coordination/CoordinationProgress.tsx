import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
                Everything is arranged. Enjoy it.
              </p>
              <button
                className={`${primaryButtonClass} mt-4`}
                disabled={markDone.isPending}
                onClick={() => markDone.mutate()}
                type="button"
              >
                {markDone.isPending ? "Saving…" : "I went to this"}
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
