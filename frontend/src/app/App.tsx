import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Navbar } from "@/components/Navbar";
import { ActivityWorkflowProvider } from "@/features/activities/ActivityWorkflowProvider";
import { VoiceCompanion } from "@/features/voice/VoiceCompanion";
import { useViewerRole } from "@/hooks/useViewerRole";
import styles from "./AppShell.module.css";

// Pages a trusted contact is actually allowed to reach. Everything else
// under _authenticated is a household-side page (discover, setup, the demo
// family view) that assumes a household exists and would otherwise show a
// broken or empty state for someone who has no household at all.
export function isTrustedContactPath(pathname: string) {
  return pathname === "/family-portal" || pathname.startsWith("/plans/");
}

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

  // ActivityWorkflowProvider is always mounted, even for a trusted contact,
  // because TanStack Router's Outlet/Match tree can render a matched child
  // route's component as part of its own internal match resolution even
  // when it is not the branch we display below - a route that depends on
  // this context (like /discover's ActivityDiscovery) would otherwise crash
  // outright rather than just being visually hidden. VoiceCompanion stays
  // gated on role since it is a floating, visible control, not a context.
  return (
    <div className={styles.clnShell}>
      <a className={styles.clnSkipLink} href="#main-content">
        Skip to main content
      </a>
      <ActivityWorkflowProvider>
        <Navbar />
        <main className={styles.clnMain} id="main-content">
          {isBlocked ? <RedirectingMessage /> : <Outlet />}
        </main>
        {isTrustedContact ? null : <VoiceCompanion />}
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
