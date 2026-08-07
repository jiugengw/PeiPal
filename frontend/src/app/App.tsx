import { Outlet } from "@tanstack/react-router";
import { Navbar } from "@/components/Navbar";
import { ActivityWorkflowProvider } from "@/features/activities/ActivityWorkflowProvider";
import { VoiceCompanion } from "@/features/voice/VoiceCompanion";
import styles from "./AppShell.module.css";

export function App() {
  return (
    <div className={styles.clnShell}>
      <a className={styles.clnSkipLink} href="#main-content">
        Skip to main content
      </a>
      <ActivityWorkflowProvider>
        <Navbar />
        <main className={styles.clnMain} id="main-content">
          <Outlet />
        </main>
        <VoiceCompanion />
      </ActivityWorkflowProvider>
    </div>
  );
}
