import { Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type CSSProperties } from "react";
import { Navbar } from "@/components/Navbar";
import { ActivityWorkflowProvider } from "@/features/activities/ActivityWorkflowProvider";
import { StagedIntentProvider } from "@/app/providers/StagedIntentProvider";
import { CompanionPanel } from "@/features/companion/CompanionPanel";
import { canReach, homePathFor } from "@/app/roleAccess";
import { useViewer } from "@/hooks/useViewer";
import styles from "./AppShell.module.css";

const DEFAULT_COMPANION_WIDTH = 380;
const MIN_COMPANION_WIDTH = 320;
const MAX_COMPANION_WIDTH = 520;
const COMPANION_WIDTH_KEY = "peipal-companion-width";

function storedCompanionWidth() {
  if (typeof window === "undefined") return DEFAULT_COMPANION_WIDTH;
  const value = Number(window.localStorage.getItem(COMPANION_WIDTH_KEY));
  return Number.isFinite(value) && value >= MIN_COMPANION_WIDTH && value <= MAX_COMPANION_WIDTH
    ? value
    : DEFAULT_COMPANION_WIDTH;
}

export function App() {
  const { role, isPending } = useViewer();
  const location = useLocation();
  const navigate = useNavigate();
  const [companionOpen, setCompanionOpen] = useState(false);
  const [companionWidth, setCompanionWidth] = useState(storedCompanionWidth);
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
          <div
            className={`${styles.clnWorkspace} ${companionOpen ? styles.clnWorkspaceWithCompanion : ""}`}
            style={{ "--companion-width": `${companionWidth}px` } as CSSProperties}
          >
            <main className={styles.clnMain} id="main-content">
              {isBlocked ? <RedirectingMessage /> : <Outlet />}
            </main>
            {role === "older_adult" && (
              <CompanionPanel
                isOpen={companionOpen}
                width={companionWidth}
                onOpen={() => setCompanionOpen(true)}
                onClose={() => setCompanionOpen(false)}
                onWidthChange={(width) => {
                  setCompanionWidth(width);
                  window.localStorage.setItem(COMPANION_WIDTH_KEY, String(width));
                }}
              />
            )}
          </div>
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
