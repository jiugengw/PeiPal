import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { StagedIntentProvider } from "@/app/providers/StagedIntentProvider";
import { Navbar } from "@/components/Navbar";
import { ActivityWorkflowProvider } from "@/features/activities/ActivityWorkflowProvider";
import { CompanionPanel } from "@/features/companion/CompanionPanel";
import { useViewerRole } from "@/hooks/useViewerRole";
import styles from "./AppShell.module.css";
import { isTrustedContactPath } from "./trustedContactPaths";

export function App() {
  const { role } = useViewerRole();
  const location = useLocation();
  const navigate = useNavigate();
  const isTrustedContact = role === "trusted_contact";
  const isBlocked = isTrustedContact && !isTrustedContactPath(location.pathname);

  useEffect(() => {
    if (isBlocked) {
      void navigate({ to: "/family-portal", replace: true });
    }
  }, [isBlocked, navigate]);

  // The application providers stay mounted even for a trusted contact,
  // because TanStack Router's Outlet/Match tree can render a matched child
  // route's component as part of its own internal match resolution even
  // when it is not the branch we display below - a route that depends on
  // these contexts would otherwise crash outright rather than just being
  // visually hidden. CompanionPanel stays gated on role since it is a
  // floating, visible control, not a context.
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
          {isTrustedContact ? null : <CompanionPanel />}
        </StagedIntentProvider>
      </ActivityWorkflowProvider>
    </div>
  );
}

function RedirectingMessage() {
  return (
    <section className="grid min-h-full place-items-center px-6 py-12 text-center">
      <p className="text-xl font-bold text-foreground" role="status">
        Taking you to your family portal…
      </p>
    </section>
  );
}
