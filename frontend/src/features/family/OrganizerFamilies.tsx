import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { familiesQueryOptions } from "@/features/setup/api/setupQueries";

const primaryButtonClass =
  "inline-flex min-h-14 items-center justify-center rounded-xl bg-primary px-6 font-extrabold text-primary-foreground no-underline hover:bg-foreground";

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/**
 * The organizer's landing page, on every sign-up and every login. An
 * organizer can now set up more than one family - this lists whichever
 * ones they already have, and is how they add or edit any of them, rather
 * than assuming there is exactly one.
 */
export function OrganizerFamilies() {
  const familiesQuery = useQuery(familiesQueryOptions());

  if (familiesQuery.isPending) {
    return <Message status title="Loading your families…" />;
  }
  if (familiesQuery.isError) {
    return (
      <Message title="We could not load your families.">
        <button
          className={primaryButtonClass}
          onClick={() => void familiesQuery.refetch()}
          type="button"
        >
          Try again
        </button>
      </Message>
    );
  }

  const families = familiesQuery.data?.families ?? [];

  return (
    <section className="min-h-full bg-[linear-gradient(105deg,var(--muted)_0%,var(--background)_72%)] px-5 py-8 sm:px-8 lg:px-12 lg:py-12">
      <div className="mx-auto w-full max-w-[900px]">
        <header className="border-b border-border pb-8">
          <h1 className="max-w-[16ch] text-4xl font-bold leading-[0.98] tracking-[-0.035em] text-balance text-foreground sm:text-5xl">
            Your families
          </h1>
          <p className="mt-4 max-w-[65ch] text-lg leading-relaxed text-foreground">
            Each family has its own older adult, trusted people, and plans.
            Add one for every older adult you support.
          </p>
        </header>

        {families.length === 0 ? (
          <p className="mt-8 rounded-2xl bg-background p-6 text-lg text-foreground">
            You haven&rsquo;t added a family yet.
          </p>
        ) : (
          <ul className="mt-8 divide-y divide-border border-y border-border bg-background">
            {families.map((family) => (
              <li key={family.id}>
                <Link
                  className="flex items-center justify-between gap-4 px-5 py-5 no-underline hover:bg-muted sm:px-7"
                  search={{ familyId: family.id }}
                  to="/setup"
                >
                  <span>
                    <strong className="text-xl text-foreground">
                      {family.name}
                    </strong>
                    <p className="mt-1 text-base text-foreground">
                      Added {dateFormatter.format(new Date(family.created_at))}
                    </p>
                  </span>
                  <span aria-hidden="true" className="text-2xl text-foreground">
                    ›
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-8">
          <Link className={primaryButtonClass} to="/setup">
            Add family
          </Link>
        </div>
      </div>
    </section>
  );
}

function Message({
  title,
  status = false,
  children,
}: {
  title: string;
  status?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <section className="grid min-h-full place-items-center px-6 py-12 text-center">
      <div>
        <h1
          className="text-3xl font-bold text-foreground"
          {...(status ? { role: "status" } : {})}
        >
          {title}
        </h1>
        {children ? <div className="mt-5">{children}</div> : null}
      </div>
    </section>
  );
}
