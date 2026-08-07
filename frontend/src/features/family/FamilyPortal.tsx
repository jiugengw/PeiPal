import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { secondaryButtonClass } from "@/features/activities/activityStyles";
import { FamilyPlanRow } from "@/features/family/FamilyPlanRow";
import {
  familyPlansQueryOptions,
  trustedContactActorId,
  type TrustedContactLink,
} from "@/features/family/api/trustedContactQueries";
import { useViewerRole } from "@/hooks/useViewerRole";

export function FamilyPortal() {
  const { role, isPending, isError, acceptedLinks, linksQuery } = useViewerRole();
  const [selectedOlderAdultId, setSelectedOlderAdultId] = useState<number>();

  if (isPending) return <PortalMessage message="Loading your family portal…" status />;
  if (isError) {
    return (
      <PortalMessage
        message="We could not load your family portal."
        action={() => void linksQuery.refetch()}
      />
    );
  }
  if (role !== "trusted_contact") {
    return (
      <PortalMessage message="You do not have an accepted family-portal invitation yet. Check your email for an invitation, or ask the person who invited you to resend it." />
    );
  }

  const activeLink =
    acceptedLinks.find((link) => link.older_adult_id === selectedOlderAdultId) ?? acceptedLinks[0];

  return (
    <section className="min-h-full bg-[linear-gradient(105deg,var(--muted)_0%,var(--background)_72%)] px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
      <div className="mx-auto w-full max-w-[1100px]">
        <header className="border-b border-border pb-8">
          <h1 className="max-w-[16ch] text-4xl font-bold leading-[0.98] tracking-[-0.035em] text-balance text-foreground sm:text-5xl">
            You&rsquo;re helping {olderAdultDisplayName(activeLink)}.
          </h1>
          <p className="mt-4 max-w-[65ch] text-lg leading-relaxed text-foreground">
            Review plans that need a decision, and offer one practical way to help with anything already shared.
          </p>
        </header>

        {acceptedLinks.length > 1 ? (
          <div className="flex flex-wrap gap-2 border-b border-border py-4" role="tablist" aria-label="Choose who you're helping">
            {acceptedLinks.map((link) => (
              <button
                aria-pressed={link.older_adult_id === activeLink.older_adult_id}
                className={`inline-flex min-h-12 items-center rounded-xl px-4 font-bold ${link.older_adult_id === activeLink.older_adult_id ? "bg-accent text-foreground" : "border border-input bg-background text-foreground hover:bg-muted"}`}
                key={link.older_adult_id}
                onClick={() => setSelectedOlderAdultId(link.older_adult_id)}
                type="button"
              >
                {olderAdultDisplayName(link)}
              </button>
            ))}
          </div>
        ) : null}

        <FamilyPortalPlans link={activeLink} />
      </div>
    </section>
  );
}

function FamilyPortalPlans({ link }: { link: TrustedContactLink }) {
  const plansQuery = useQuery(familyPlansQueryOptions(link.older_adult_id));

  if (plansQuery.isPending) return <p className="py-10 text-lg font-bold text-foreground" role="status">Loading plans…</p>;
  if (plansQuery.isError) {
    return (
      <div className="py-10" role="alert">
        <p className="text-lg font-bold text-foreground">We could not load plans right now.</p>
        <button className={`${secondaryButtonClass} mt-4`} onClick={() => void plansQuery.refetch()} type="button">Try again</button>
      </div>
    );
  }

  const plans = plansQuery.data?.plans ?? [];
  const olderAdultName = olderAdultDisplayName(link);
  const myActorId = trustedContactActorId(link.id);
  const sections = [
    {
      id: "needs-review",
      title: "Needs your review",
      description: "These plans are waiting for a clear decision.",
      plans: plans.filter((plan) => plan.status === "awaiting_approval"),
      empty: "Nothing needs your review right now.",
    },
    {
      id: "shared",
      title: "Shared plans",
      description: "Offer one practical way to help, or simply leave the plan as it is.",
      plans: plans.filter((plan) => plan.status === "shared"),
      empty: "No plans have been shared yet.",
    },
  ];

  return (
    <>
      {sections.map((section) => (
        <section aria-labelledby={`${section.id}-heading`} className="py-10" id={section.id} key={section.id}>
          <h2 className="text-3xl font-bold tracking-[-0.03em] text-foreground" id={`${section.id}-heading`}>{section.title}</h2>
          <p className="mt-2 max-w-[65ch] text-lg leading-relaxed text-foreground">{section.description}</p>
          <div className="mt-6 bg-background px-5 sm:px-7">
            {section.plans.length === 0 ? (
              <p className="py-7 text-lg text-foreground">{section.empty}</p>
            ) : (
              section.plans.map((plan) => (
                <FamilyPlanRow key={plan.id} olderAdultName={olderAdultName} plan={plan} userId={myActorId} />
              ))
            )}
          </div>
        </section>
      ))}
    </>
  );
}

function olderAdultDisplayName(link?: TrustedContactLink) {
  return link?.older_adult_preferred_name || link?.older_adult_name || "your family member";
}

function PortalMessage({ message, action, status = false }: { message: string; action?: () => void; status?: boolean }) {
  return (
    <section className="grid min-h-full place-items-center px-6 py-12 text-center">
      <div>
        <h1 className="text-3xl font-bold text-foreground" {...(status ? { role: "status" } : {})}>{message}</h1>
        {action ? (
          <button className="mt-5 min-h-14 rounded-xl bg-primary px-6 font-bold text-primary-foreground" onClick={action} type="button">
            Try again
          </button>
        ) : null}
      </div>
    </section>
  );
}
