import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { TaskCard } from "@/features/coordination/TaskCard";
import {
  actOnTask,
  coordinationQueryKey,
  coordinationQueryOptions,
  CoordinationError,
  type CoordinationAction,
  type TaskType,
} from "@/features/coordination/api/coordinationQueries";
import { formatDecisionWhen } from "@/features/coordination/format";

const SETTLED = ["ready", "completed", "rejected", "cancelled"];

// Cards are always shown in this order, regardless of the order the backend
// returns tasks in or how their statuses change after an action. Without
// this, acting on a task (e.g. approving) could reshuffle the list and make
// the card someone just used jump to a different position.
const TASK_ORDER: TaskType[] = ["approval", "registration", "transport"];

function byTaskOrder(a: { task_type: TaskType }, b: { task_type: TaskType }) {
  return TASK_ORDER.indexOf(a.task_type) - TASK_ORDER.indexOf(b.task_type);
}

/**
 * The page a family member opens from their email. Public on purpose: they hold
 * no account, so the token in the link is what identifies them. The same link
 * keeps working, so they can come back to watch how things are going.
 */
export function CoordinationPage({ token }: { token: string }) {
  const queryClient = useQueryClient();
  const stateQuery = useQuery(coordinationQueryOptions(token));

  const act = useMutation({
    mutationFn: ({
      taskType,
      action,
      version,
      reason,
    }: {
      taskType: TaskType;
      action: CoordinationAction;
      version: number;
      reason?: string;
    }) => actOnTask(token, taskType, action, version, reason),
    onSuccess: (next) =>
      queryClient.setQueryData(coordinationQueryKey(token), next),
    onError: () =>
      // A lost race means the page is stale; show the truth immediately.
      void queryClient.invalidateQueries({
        queryKey: coordinationQueryKey(token),
      }),
  });

  if (stateQuery.isPending) {
    return <Message title="Opening this request…" status />;
  }

  if (stateQuery.isError) {
    const error = stateQuery.error;
    const gone =
      error instanceof CoordinationError &&
      (error.status === 404 || error.status === 410);
    return (
      <Message
        title={gone ? "This link is no longer valid." : "We could not open this link."}
        detail={
          gone
            ? "It may have expired, or your family may have removed it. Ask them to send a new one."
            : "Please check your connection and try again."
        }
      />
    );
  }

  const state = stateQuery.data;
  const settled = SETTLED.includes(state.plan_status);
  const conflict =
    act.error instanceof CoordinationError && act.error.status === 409;
  // Registration and transport are only meaningful once the family has said
  // yes - claiming a role for an activity nobody has approved yet would let
  // someone act ahead of that decision.
  const approvalTask = state.tasks.find((task) => task.task_type === "approval");
  const isApproved = approvalTask?.status === "approved";

  return (
    <section className="min-h-full bg-[linear-gradient(105deg,var(--muted)_0%,var(--background)_72%)] px-5 py-8 sm:px-8 lg:py-12">
      <div className="mx-auto w-full max-w-[820px]">
        <header>
          {state.responding_as ? (
            <p className="text-lg font-bold text-foreground">
              You are responding as {state.responding_as}
            </p>
          ) : null}
          <h1 className="mt-3 text-4xl font-bold leading-[1.02] tracking-[-0.035em] text-balance text-foreground sm:text-5xl">
            {state.older_adult} would like to join an activity.
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-foreground">
            Everyone in the family can see this page. The first person to approve
            or reject decides for everyone, and anyone can offer to help.
          </p>
        </header>

        <div className="mt-8 rounded-2xl bg-background p-6 shadow-[0_18px_45px_rgb(37_44_64_/_0.10)]">
          <h2 className="text-2xl font-bold text-foreground">
            {state.activity.name}
          </h2>
          <dl className="mt-4 divide-y divide-border border-y border-border text-base text-foreground">
            <Row label="When" value={formatDecisionWhen(state.activity.start_at)} />
            <Row label="Where" value={state.activity.location} />
          </dl>
          <a
            className="mt-4 inline-block text-lg font-bold text-foreground underline"
            href={state.activity.info_link}
            rel="noreferrer"
            target="_blank"
          >
            More about this activity
          </a>
        </div>

        <PlanBanner status={state.plan_status} olderAdult={state.older_adult} />

        {conflict ? (
          <p
            className="mt-6 rounded-2xl bg-muted p-5 font-bold text-foreground"
            role="alert"
          >
            Someone in the family acted at the same moment. We have refreshed
            this page so you can see what happened.
          </p>
        ) : act.isError ? (
          <p className="mt-6 font-bold text-foreground" role="alert">
            {act.error.message}
          </p>
        ) : null}

        <div className="mt-6 grid gap-4">
          {state.tasks.slice().sort(byTaskOrder).map((task) => (
            <TaskCard
              key={task.task_type}
              task={task}
              respondingAs={state.responding_as}
              isApproved={isApproved}
              isBusy={act.isPending}
              isSettled={settled}
              onAct={(action, reason) =>
                act.mutate({
                  taskType: task.task_type,
                  action,
                  version: task.version,
                  reason,
                })
              }
            />
          ))}
        </div>

        {state.events.length > 0 ? (
          <section className="mt-10" aria-labelledby="history-heading">
            <h2
              className="text-2xl font-bold tracking-[-0.025em] text-foreground"
              id="history-heading"
            >
              What the family has done
            </h2>
            <ul className="mt-4 divide-y divide-border border-y border-border">
              {state.events.map((event, index) => (
                <li className="py-3 text-base text-foreground" key={index}>
                  <strong>{event.actor_name}</strong> {event.action}
                  {event.task_type ? ` — ${event.task_type}` : ""}
                  <span className="block text-foreground/80">
                    {formatDecisionWhen(event.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </section>
  );
}

function PlanBanner({
  status,
  olderAdult,
}: {
  status: string;
  olderAdult: string;
}) {
  if (status === "coordinating" || status === "draft") return null;
  const messages: Record<string, string> = {
    ready: `Everything is arranged. ${olderAdult} is all set for this activity.`,
    completed: `This activity is done. Thank you for helping ${olderAdult}.`,
    rejected: `The family decided against this one. Nothing further will happen.`,
    cancelled: `${olderAdult} cancelled this plan.`,
  };
  return (
    <p
      className="mt-6 rounded-2xl bg-muted p-5 text-lg font-bold text-foreground"
      role="status"
    >
      {messages[status] ?? "This plan is settled."}
    </p>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-4">
      <dt className="font-bold">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

function Message({
  title,
  detail,
  status = false,
}: {
  title: string;
  detail?: string;
  status?: boolean;
}) {
  return (
    <section className="grid min-h-full place-items-center px-6 py-12 text-center">
      <div className="max-w-[560px]">
        <h1
          className="text-3xl font-bold text-foreground"
          {...(status ? { role: "status" } : {})}
        >
          {title}
        </h1>
        {detail ? (
          <p className="mt-4 text-lg leading-relaxed text-foreground">{detail}</p>
        ) : null}
      </div>
    </section>
  );
}
