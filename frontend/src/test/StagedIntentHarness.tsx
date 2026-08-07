import { useMemo, useRef, type ReactNode } from "react";
import {
  StagedIntentContext,
  type StagedIntentValue,
} from "@/hooks/useStagedIntent";
import type { StagedIntent } from "@/types/stagedIntent";

/**
 * Renders a panel as though the companion had staged an action for it, and
 * exposes a "harness confirm" button that runs whatever the panel registered —
 * the same call the confirm_staged_action tool makes.
 */
export function StagedIntentHarness({
  intent,
  children,
}: {
  intent?: StagedIntent;
  children: ReactNode;
}) {
  const commitRef = useRef<(() => void) | undefined>(undefined);

  const value = useMemo<StagedIntentValue>(
    () => ({
      intent,
      stage: () => {
        throw new Error("Staging is not exercised through this harness.");
      },
      clear: () => {
        commitRef.current = undefined;
      },
      registerCommit: (commit) => {
        commitRef.current = commit;
        return () => {
          if (commitRef.current === commit) commitRef.current = undefined;
        };
      },
      commit: () => {
        if (!commitRef.current)
          throw new Error(
            "There is nothing waiting to be confirmed on screen right now.",
          );
        commitRef.current();
      },
    }),
    [intent],
  );

  return (
    <StagedIntentContext.Provider value={value}>
      {children}
      <button type="button" onClick={() => value.commit()}>
        harness confirm
      </button>
    </StagedIntentContext.Provider>
  );
}
