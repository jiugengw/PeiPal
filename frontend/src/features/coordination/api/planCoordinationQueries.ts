import { queryOptions } from "@tanstack/react-query";
import type { components } from "@/generated/api";
import { CoordinationError } from "@/features/coordination/api/coordinationQueries";
import { fetchClient } from "@/lib/fetchClient";

export type CoordinationLaunch = components["schemas"]["CoordinationLaunchResponse"];

function detailMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "detail" in error) {
    const detail = (error as { detail?: unknown }).detail;
    if (typeof detail === "string") return detail;
  }
  return fallback;
}

export const planCoordinationQueryKey = (planId: number) =>
  ["plan-coordination", planId] as const;

/** The older adult's own view of how their request is going. */
export function planCoordinationQueryOptions(planId: number) {
  return queryOptions({
    queryKey: planCoordinationQueryKey(planId),
    refetchInterval: 5000,
    retry: false,
    queryFn: async () => {
      const { data, error, response } = await fetchClient.GET(
        "/api/plans/{plan_id}/coordination",
        { params: { path: { plan_id: planId } } },
      );
      if (error || !data) {
        throw new CoordinationError(
          detailMessage(error, "We could not load your family's progress."),
          response.status,
        );
      }
      return data;
    },
  });
}

export async function askTheFamily(planId: number) {
  const { data, error, response } = await fetchClient.POST(
    "/api/plans/{plan_id}/coordination",
    { params: { path: { plan_id: planId } } },
  );
  if (error || !data) {
    throw new CoordinationError(
      detailMessage(error, "We could not ask your family yet."),
      response.status,
    );
  }
  return data;
}

export async function markPlanDone(planId: number) {
  const { data, error, response } = await fetchClient.POST(
    "/api/plans/{plan_id}/complete",
    { params: { path: { plan_id: planId } } },
  );
  if (error || !data) {
    throw new CoordinationError(
      detailMessage(error, "We could not mark this as done."),
      response.status,
    );
  }
  return data;
}
