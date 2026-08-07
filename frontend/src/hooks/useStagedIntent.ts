import { createContext, useContext, useEffect, useRef } from "react";
import type {
  StagedIntent,
  StagedIntentKind,
  StagedIntentOf,
  StagedIntentPayload,
} from "@/types/stagedIntent";

export interface StagedIntentValue {
  intent: StagedIntent | undefined;
  /** Stage an action on `path`. Callers navigate to `path` first. */
  stage: (payload: StagedIntentPayload, path: string) => StagedIntent;
  clear: () => void;
  /** Registers the visible confirm button's handler. Returns an unregister fn. */
  registerCommit: (commit: () => void) => () => void;
  /** Runs the registered handler. Throws when no review block is on screen. */
  commit: () => void;
}

export function noStagedIntentAvailable(): never {
  throw new Error(
    "There is nothing waiting to be confirmed on screen right now.",
  );
}

/**
 * Panels work without the provider: staging is an enhancement the companion
 * adds, never something a page depends on. Only the App shell installs a real
 * provider, so a bare-rendered panel behaves exactly as it always has.
 */
const inertStagedIntent: StagedIntentValue = Object.freeze({
  intent: undefined,
  stage: noStagedIntentAvailable,
  clear: () => {},
  registerCommit: () => () => {},
  commit: noStagedIntentAvailable,
});

export const StagedIntentContext =
  createContext<StagedIntentValue>(inertStagedIntent);

export function useStagedIntentContext() {
  return useContext(StagedIntentContext);
}

/** For the companion tools: stage an action for the person to confirm. */
export function useStageIntent() {
  return useStagedIntentContext();
}

/** For panels: the staged intent, when it is this panel's to render. */
export function useStagedIntent<K extends StagedIntentKind>(
  kind: K,
  match?: (intent: StagedIntentOf<K>) => boolean,
): StagedIntentOf<K> | undefined {
  const { intent } = useStagedIntentContext();
  if (!intent || intent.kind !== kind) return undefined;
  const typed = intent as StagedIntentOf<K>;
  return !match || match(typed) ? typed : undefined;
}

/**
 * For panels: while `active`, expose this panel's confirm handler so that
 * saying "yes" runs exactly what pressing the button runs.
 */
export function useStagedCommit(active: boolean, commit: () => void) {
  const { registerCommit } = useStagedIntentContext();
  const commitRef = useRef(commit);
  useEffect(() => {
    commitRef.current = commit;
  });
  useEffect(() => {
    if (!active) return;
    return registerCommit(() => commitRef.current());
  }, [active, registerCommit]);
}
