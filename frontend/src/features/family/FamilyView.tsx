import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useAuthSession } from "@/features/auth/AuthSessionContext";
import { secondaryButtonClass } from "@/features/activities/activityStyles";
import { FamilyPlanRow } from "@/features/family/FamilyPlanRow";
import { plansQueryOptions } from "@/features/plans/api/planQueries";
import { useSetupProgress } from "@/features/setup/useSetupProgress";

export function FamilyView() {
  const { session } = useAuthSession();
  const setup = useSetupProgress();
  const plansQuery = useQuery({
    ...plansQueryOptions(setup.family?.id ?? 0),
    enabled: Boolean(setup.family),
  });

  if (setup.isPending || (setup.family && plansQuery.isPending)) {
    return <FamilyMessage message="Loading the family view…" status />;
  }
  if (setup.isError || plansQuery.isError) {
    return <FamilyMessage message="We could not load the family view." action={() => { void setup.familiesQuery.refetch(); void plansQuery.refetch(); }} />;
  }

  const plans = plansQuery.data?.plans ?? [];
  const olderAdultName = setup.olderAdult?.preferred_name || setup.olderAdult?.name || "Your family member";
  const sections = [
    {
      id: "approval",
      title: "Waiting for a family decision",
      description: "Everyone has been emailed. The first person to approve or reject decides for the whole family.",
      plans: plans.filter((plan) => plan.status === "awaiting_approval"),
      empty: "No plans are waiting for a decision right now.",
    },
    {
      id: "decided",
      title: "Decided",
      description: "What the family decided, and who decided it.",
      plans: plans.filter((plan) => plan.status === "approved" || plan.status === "rejected"),
      empty: "No plans have been decided yet.",
    },
    {
      id: "shared",
      title: "Shared plans",
      description: "Offer one practical way to help, or simply leave the plan as it is.",
      plans: plans.filter((plan) => plan.status === "shared"),
      empty: "No plans have been shared yet.",
    },
    {
      id: "past",
      title: "Past plans",
      description: "Cancelled plans stay here for context.",
      plans: plans.filter((plan) => plan.status === "cancelled"),
      empty: "There are no past plans.",
    },
  ];

  return (
    <section className="min-h-full bg-[linear-gradient(105deg,var(--muted)_0%,var(--background)_72%)] px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
      <div className="mx-auto w-full max-w-[1100px]">
        <header className="grid gap-6 border-b border-border pb-8 lg:grid-cols-[minmax(0,1fr)_310px] lg:items-end">
          <div>
            <h1 className="max-w-[16ch] text-4xl font-bold leading-[0.98] tracking-[-0.035em] text-balance text-foreground sm:text-5xl">A clear view of where help fits.</h1>
            <p className="mt-4 max-w-[65ch] text-lg leading-relaxed text-foreground">See what {olderAdultName} has asked for, what the family decided, and where a small kind of support would help.</p>
          </div>
          <div className="rounded-2xl bg-background p-5 shadow-[0_18px_45px_rgb(37_44_64_/_0.10)]">
            <p className="text-lg font-bold text-foreground">Demo family view</p>
            <p className="mt-2 text-base leading-relaxed text-foreground">Family members decide from the link in their email and do not need an account. This page shows the same plans from the family side.</p>
          </div>
        </header>

        <nav className="flex gap-2 overflow-x-auto border-b border-border py-4" aria-label="Family plan sections">
          {sections.map((section) => <a className="inline-flex min-h-12 shrink-0 items-center rounded-xl px-4 font-bold text-foreground hover:bg-background" href={`#${section.id}`} key={section.id}>{section.title} · {section.plans.length}</a>)}
        </nav>

        {sections.map((section) => (
          <section className={`py-10 ${section.id === "past" ? "opacity-75" : ""}`} id={section.id} key={section.id} aria-labelledby={`${section.id}-heading`}>
            <h2 className="text-3xl font-bold tracking-[-0.03em] text-foreground" id={`${section.id}-heading`}>{section.title}</h2>
            <p className="mt-2 max-w-[65ch] text-lg leading-relaxed text-foreground">{section.description}</p>
            <div className="mt-6 bg-background px-5 sm:px-7">
              {section.plans.length === 0 ? <p className="py-7 text-lg text-foreground">{section.empty}</p> : section.plans.map((plan) => <FamilyPlanRow key={plan.id} plan={plan} olderAdultName={olderAdultName} userId={session?.user.id} />)}
            </div>
          </section>
        ))}

        <div className="border-t border-border pt-8">
          <Link className={`${secondaryButtonClass} no-underline`} to="/discover">Back to activities</Link>
        </div>
      </div>
    </section>
  );
}

function FamilyMessage({ message, action, status = false }: { message: string; action?: () => void; status?: boolean }) {
  return <section className="grid min-h-full place-items-center px-6 py-12 text-center"><div><h1 className="text-3xl font-bold text-foreground" {...(status ? { role: "status" } : {})}>{message}</h1>{action ? <button className="mt-5 min-h-14 rounded-xl bg-primary px-6 font-bold text-primary-foreground" onClick={action} type="button">Try again</button> : null}</div></section>;
}
