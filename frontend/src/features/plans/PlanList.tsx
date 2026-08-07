import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { toActivity } from "@/features/activities/api/toActivity";
import { formatActivityWhen } from "@/features/activities/format";
import {
  activityDetailQueryOptions,
  plansQueryOptions,
  type Plan,
} from "@/features/plans/api/planQueries";
import { planStatusLabels } from "@/features/plans/status";
import { useViewer } from "@/hooks/useViewer";

const secondaryButtonClass =
  "inline-flex min-h-14 items-center justify-center rounded-xl border border-input bg-background px-6 font-extrabold text-foreground no-underline hover:bg-muted";

/** Everything the older adult has asked about, and where each one has got to. */
export function PlanList() {
  const viewer = useViewer();
  const plansQuery = useQuery({
    ...plansQueryOptions(viewer.familyId ?? 0),
    enabled: Boolean(viewer.familyId),
  });

  if (viewer.isPending || plansQuery.isPending) {
    return <Message title="Loading your activities…" status />;
  }
  if (viewer.isError || plansQuery.isError) {
    return <Message title="We could not load your activities." />;
  }

  const plans = (plansQuery.data?.plans ?? []).filter(
    (plan) => !viewer.olderAdultId || plan.older_adult_id === viewer.olderAdultId,
  );
  const active = plans.filter(
    (plan) => plan.status === "coordinating" || plan.status === "draft" || plan.status === "ready",
  );
  const past = plans.filter((plan) => !active.includes(plan));

  return (
    <section className="min-h-full bg-[linear-gradient(105deg,var(--muted)_0%,var(--background)_72%)] px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
      <div className="mx-auto w-full max-w-[900px]">
        <header className="border-b border-border pb-8">
          <h1 className="max-w-[16ch] text-4xl font-bold leading-[0.98] tracking-[-0.035em] text-balance text-foreground sm:text-5xl">
            Your activities.
          </h1>
          <p className="mt-4 max-w-[65ch] text-lg leading-relaxed text-foreground">
            Everything you have asked your family about, and how each one is
            going.
          </p>
        </header>

        <Section
          title="Happening now"
          empty="You have not asked about anything yet."
          plans={active}
        />
        <Section title="Finished" empty="Nothing has finished yet." plans={past} />

        <div className="border-t border-border pt-8">
          <Link className={secondaryButtonClass} to="/discover">
            Find something new
          </Link>
        </div>
      </div>
    </section>
  );
}

function Section({
  title,
  empty,
  plans,
}: {
  title: string;
  empty: string;
  plans: Plan[];
}) {
  return (
    <section className="py-8" aria-labelledby={`${title}-heading`}>
      <h2
        className="text-2xl font-bold tracking-[-0.03em] text-foreground"
        id={`${title}-heading`}
      >
        {title}
      </h2>
      {plans.length === 0 ? (
        <p className="mt-4 text-lg text-foreground">{empty}</p>
      ) : (
        <ul className="mt-4 divide-y divide-border border-y border-border bg-background">
          {plans.map((plan) => (
            <PlanRow key={plan.id} plan={plan} />
          ))}
        </ul>
      )}
    </section>
  );
}

function PlanRow({ plan }: { plan: Plan }) {
  const activityQuery = useQuery(activityDetailQueryOptions(plan.activity_id));
  const activity = activityQuery.data ? toActivity(activityQuery.data) : null;

  return (
    <li className="flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
      <div className="min-w-0">
        <strong className="text-xl text-foreground">
          {activity ? activity.title : "Loading activity…"}
        </strong>
        {activity ? (
          <p className="mt-1 text-base text-foreground">
            {formatActivityWhen(activity)} · {activity.venue}
          </p>
        ) : null}
        <p className="mt-1 text-lg font-bold text-foreground">
          {planStatusLabels[plan.status]}
        </p>
      </div>
      <Link
        className={`${secondaryButtonClass} shrink-0`}
        params={{ planId: String(plan.id) }}
        to="/plans/$planId"
      >
        See progress
      </Link>
    </li>
  );
}

function Message({ title, status = false }: { title: string; status?: boolean }) {
  return (
    <section className="grid min-h-full place-items-center px-6 py-12 text-center">
      <h1
        className="text-3xl font-bold text-foreground"
        {...(status ? { role: "status" } : {})}
      >
        {title}
      </h1>
    </section>
  );
}
