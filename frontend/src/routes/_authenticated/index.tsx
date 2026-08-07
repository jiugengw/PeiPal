import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useViewerRole } from "@/hooks/useViewerRole";

export const Route = createFileRoute("/_authenticated/")({
  component: HomePage,
});

function HomePage() {
  const { role, setup, isPending, isError } = useViewerRole();
  const navigate = useNavigate();

  useEffect(() => {
    if (isPending || isError) return;
    if (role === "trusted_contact") {
      void navigate({ to: "/family-portal", replace: true });
      return;
    }
    void navigate({
      to: setup.isComplete ? "/discover" : "/setup",
      replace: true,
    });
  }, [isError, isPending, navigate, role, setup.isComplete]);

  if (isError) {
    return (
      <section className="grid min-h-full place-items-center px-6 py-12 text-center">
        <div>
          <h1 className="text-4xl font-bold tracking-[-0.035em] text-foreground">
            We could not check your setup.
          </h1>
          <p className="mt-4 text-lg text-foreground">
            Check your connection and try again.
          </p>
          <button
            className="mt-6 min-h-14 rounded-xl bg-primary px-6 font-extrabold text-primary-foreground hover:bg-foreground"
            onClick={() => void setup.householdsQuery.refetch()}
          >
            Try again
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="grid min-h-full place-items-center px-6 py-12 text-center">
      <p className="text-xl font-bold text-foreground" role="status">
        Checking your setup…
      </p>
    </section>
  );
}
