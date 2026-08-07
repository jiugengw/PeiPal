import { useCallback, useRef, useState, type ReactNode } from "react";
import { useLocation } from "@tanstack/react-router";
import { StagedIntentContext } from "@/hooks/useStagedIntent";
import type { StagedIntent, StagedIntentPayload } from "@/types/stagedIntent";

let nextIntentId = 0;

export function StagedIntentProvider({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [intent, setIntent] = useState<StagedIntent>();
  const commitRef = useRef<(() => void) | undefined>(undefined);

  const clear = useCallback(() => {
    setIntent(undefined);
    commitRef.current = undefined;
  }, []);

  // A staged action belongs to the page that shows its review block. Leaving
  // that page is the same as pressing "Go back", so drop it.
  // Dropping the intent is enough: the panel that owns the confirm handler
  // unregisters it as soon as it stops matching.
  const [seenPathname, setSeenPathname] = useState(pathname);
  if (seenPathname !== pathname) {
    setSeenPathname(pathname);
    if (intent && intent.path !== pathname) setIntent(undefined);
  }

  const stage = useCallback((payload: StagedIntentPayload, path: string) => {
    nextIntentId += 1;
    const staged = { ...payload, id: `intent-${nextIntentId}`, path };
    commitRef.current = undefined;
    setIntent(staged);
    return staged;
  }, []);

  const registerCommit = useCallback((commit: () => void) => {
    commitRef.current = commit;
    return () => {
      if (commitRef.current === commit) commitRef.current = undefined;
    };
  }, []);

  const commit = useCallback(() => {
    if (!commitRef.current)
      throw new Error(
        "There is nothing waiting to be confirmed on screen right now.",
      );
    commitRef.current();
  }, []);

  return (
    <StagedIntentContext.Provider
      value={{ intent, stage, clear, registerCommit, commit }}
    >
      {children}
    </StagedIntentContext.Provider>
  );
}
