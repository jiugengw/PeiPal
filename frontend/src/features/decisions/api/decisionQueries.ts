import { queryOptions } from "@tanstack/react-query";
import type { components } from "@/generated/api";
import { fetchClient } from "@/lib/fetchClient";

export type PlanDecision = components["schemas"]["PlanDecisionResponse"];
export type DecisionDelivery = components["schemas"]["DecisionDeliveryResponse"];

/** What the approval link shows before anyone decides. */
export interface DecisionInvitation {
  plan_id: number;
  plan_status: string;
  family_member: string;
  older_adult: string;
  activity: {
    name: string;
    location: string;
    start_at: string;
    info_link: string;
  };
  can_decide: boolean;
}

export class DecisionRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "DecisionRequestError";
    this.status = status;
  }
}

function detailMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "detail" in error) {
    const detail = (error as { detail?: unknown }).detail;
    if (typeof detail === "string") return detail;
  }
  return fallback;
}

export const decisionQueryKey = (token: string) =>
  ["family-decision", token] as const;

export function decisionQueryOptions(token: string) {
  return queryOptions({
    queryKey: decisionQueryKey(token),
    // A decision link is single use, so never serve it from a stale cache.
    staleTime: 0,
    retry: false,
    queryFn: async () => {
      const { data, error, response } = await fetchClient.GET(
        "/api/family-decisions/{token}",
        { params: { path: { token } } },
      );
      if (error || !data) {
        throw new DecisionRequestError(
          detailMessage(error, "We could not open this decision link."),
          response.status,
        );
      }
      return data as unknown as DecisionInvitation;
    },
  });
}

export async function submitDecision(
  token: string,
  decision: "approved" | "rejected",
  reason?: string,
) {
  const { data, error, response } = await fetchClient.POST(
    "/api/family-decisions/{token}",
    {
      params: { path: { token } },
      body: { decision, reason: reason?.trim() || null },
    },
  );
  if (error || !data) {
    throw new DecisionRequestError(
      detailMessage(error, "We could not record your decision."),
      response.status,
    );
  }
  return data;
}
