import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useSetupProgress } from "@/features/setup/useSetupProgress";
import { useViewer } from "@/hooks/useViewer";

export const Route = createFileRoute("/_authenticated/")({
  component: HomePage,
});

function HomePage() {
  const viewer = useViewer();
  // An older adult owns no family record, so the setup queries would 403.
  const progress = useSetupProgress(viewer.role === "organizer");
  const navigate = useNavigate();
  const isOlderAdult = viewer.role === "older_adult";

  useEffect(() => {
    if (viewer.isPending) return;
    // An older adult never sees setup; they arrive ready to look for activities.
    if (isOlderAdult) {
      void navigate({ to: "/discover", replace: true });
      return;
    }
    if (progress.isPending || progress.isError) return;
    void navigate({
      to: progress.isComplete ? "/discover" : "/setup",
      replace: true,
    });
  }, [
    isOlderAdult,
    navigate,
    progress.isComplete,
    progress.isError,
    progress.isPending,
    viewer.isPending,
  ]);

  if (progress.isError && !isOlderAdult) {
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
            onClick={() => void progress.familiesQuery.refetch()}
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
