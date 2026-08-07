import type { MutableRefObject } from "react";
import type { QueryClient } from "@tanstack/react-query";
import type { useNavigate } from "@tanstack/react-router";
import type { ActivityWorkflowValue } from "@/features/activities/activityWorkflowContext";
import type { useSetupProgress } from "@/features/setup/useSetupProgress";
import type { StagedIntentValue } from "@/hooks/useStagedIntent";

/**
 * Tools are built once when the session connects, so everything that changes
 * while the session is live is reached through a ref.
 */
export interface CompanionToolContext {
  toolFactory: (typeof import("@openai/agents"))["tool"];
  queryClient: QueryClient;
  navigate: ReturnType<typeof useNavigate>;
  workflowRef: MutableRefObject<ActivityWorkflowValue>;
  setupRef: MutableRefObject<ReturnType<typeof useSetupProgress>>;
  intentRef: MutableRefObject<StagedIntentValue>;
}

export const PLAN_PATH = "/plans/$planId";

export function planPath(planId: number) {
  return `/plans/${planId}`;
}
