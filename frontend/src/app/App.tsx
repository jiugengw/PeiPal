import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { ActivityWorkflowProvider } from "@/features/activities/ActivityWorkflowProvider";
import { StagedIntentProvider } from "@/app/providers/StagedIntentProvider";
import { CompanionPanel } from "@/features/companion/CompanionPanel";
import { canReach, homePathFor } from "@/app/roleAccess";
import { useViewer } from "@/hooks/useViewer";
import styles from "./AppShell.module.css";

export function App() {
  const { role, isPending } = useViewer();
  const location = useLocation();
  const navigate = useNavigate();
  const isBlocked = !isPending && !canReach(role, location.pathname);

  useEffect(() => {
    if (isBlocked) void navigate({ to: homePathFor(role), replace: true });
  }, [isBlocked, navigate, role]);

  return (
    <div className={styles.clnShell}>
      <a className={styles.clnSkipLink} href="#main-content">
        Skip to main content
      </a>
      <ActivityWorkflowProvider>
        <StagedIntentProvider>
          <Navbar />
          <main className={styles.clnMain} id="main-content">
            {isBlocked ? <RedirectingMessage /> : <Outlet />}
          </main>
          <CompanionPanel />
        </StagedIntentProvider>
      </ActivityWorkflowProvider>
    </div>
  );
}

function RedirectingMessage() {
  return (
    <section className="grid min-h-full place-items-center px-6 py-12 text-center">
      <p className="text-xl font-bold text-foreground" role="status">
        Taking you to the right place…
      </p>
    </section>
  );
}
