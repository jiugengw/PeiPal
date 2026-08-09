import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { familyMembersQueryOptions, olderAdultsQueryOptions } from "@/features/setup/api/setupQueries";
import { WhatHappensNext } from "@/features/setup/WhatHappensNext";
import { useViewer } from "@/hooks/useViewer";

const secondaryButtonClass =
  "inline-flex min-h-14 items-center justify-center rounded-xl border border-input bg-background px-6 font-extrabold text-foreground no-underline hover:bg-muted";

/** The trusted circle, shown to either the organizer or older adult. */
export function FamilyPeople() {
  const viewer = useViewer();
  const isOrganizer = viewer.role === "organizer";
  const membersQuery = useQuery({
    ...familyMembersQueryOptions(viewer.familyId ?? 0),
    enabled: Boolean(viewer.familyId),
  });
  // Only the organizer sees "what happens next" below, so this is skipped
  // entirely for the older adult's view of the same page.
  const olderAdultsQuery = useQuery({
    ...olderAdultsQueryOptions(viewer.familyId ?? 0),
    enabled: isOrganizer && Boolean(viewer.familyId),
  });

  if (viewer.isPending || membersQuery.isPending) {
    return <Message title="Loading your family…" status />;
  }
  if (viewer.isError || membersQuery.isError) {
    return <Message title="We could not load your family." />;
  }

  const members = membersQuery.data?.family_members ?? [];
  const olderAdults = olderAdultsQuery.data?.older_adults ?? [];

  function relationshipFor(relationships: { older_adult_id: number; relationship: string }[]) {
    const mine = relationships.find(
      (link) => link.older_adult_id === viewer.olderAdultId,
    );
    return mine?.relationship ?? relationships[0]?.relationship ?? "Family";
  }

  return (
    <section className="min-h-full bg-[linear-gradient(105deg,var(--muted)_0%,var(--background)_72%)] px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
      <div className="mx-auto w-full max-w-[900px]">
        <header className="border-b border-border pb-8">
          <h1 className="max-w-[16ch] text-4xl font-bold leading-[0.98] tracking-[-0.035em] text-balance text-foreground sm:text-5xl">
            {isOrganizer ? "Your trusted circle." : "Your support circle."}
          </h1>
          <p className="mt-4 max-w-[65ch] text-lg leading-relaxed text-foreground">
            {isOrganizer
              ? "These are the people PeiPal will contact when the older adult asks for support. You can update them in Setup."
              : "When you ask about an activity, everyone here is told at once. The first person to answer decides, so nobody is put on the spot."}
          </p>
        </header>

        {members.length === 0 ? (
          <p className="mt-8 rounded-2xl bg-background p-6 text-lg text-foreground">
            {isOrganizer
              ? "Nobody has been added yet. Add trusted people in Setup so they can help with plans."
              : "Nobody has been added yet. Whoever set this up for you can add your family."}
          </p>
        ) : (
          <ul className="mt-8 divide-y divide-border border-y border-border bg-background">
            {members.map((member) => (
              <li className="px-5 py-5 sm:px-7" key={member.id}>
                <strong className="text-xl text-foreground">{member.name}</strong>
                <p className="mt-1 text-lg text-foreground">
                  {relationshipFor(member.relationships)}
                </p>
              </li>
            ))}
          </ul>
        )}

        {isOrganizer ? (
          <details className="mt-8 rounded-2xl bg-background p-5 sm:p-7">
            <summary className="cursor-pointer text-lg font-bold text-foreground">
              What happens for future plans
            </summary>
            <div className="mt-4">
              <WhatHappensNext olderAdults={olderAdults} />
            </div>
          </details>
        ) : null}

        <div className="mt-8">
          <Link className={secondaryButtonClass} to={isOrganizer ? "/setup" : "/discover"}>
            {isOrganizer ? "Manage trusted circle" : "Explore activities"}
          </Link>
        </div>
      </div>
    </section>
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
