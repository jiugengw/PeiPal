import { queryOptions } from "@tanstack/react-query";
import type { components } from "@/generated/api";
import { fetchClient } from "@/lib/fetchClient";

export type CoordinationState = components["schemas"]["CoordinationStateResponse"];
export type CoordinationTask = components["schemas"]["CoordinationTaskResponse"];
export type CoordinationAction =
  components["schemas"]["CoordinationActionRequest"]["action"];
export type TaskType = CoordinationTask["task_type"];

export class CoordinationError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "CoordinationError";
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

export const coordinationQueryKey = (token: string) =>
  ["coordination", token] as const;

export function coordinationQueryOptions(token: string) {
  return queryOptions({
    queryKey: coordinationQueryKey(token),
    // Shared state: someone else may be acting at the same moment.
    refetchInterval: 5000,
    staleTime: 0,
    retry: false,
    queryFn: async () => {
      const { data, error, response } = await fetchClient.GET(
        "/api/coordination/{token}",
        { params: { path: { token } } },
      );
      if (error || !data) {
        throw new CoordinationError(
          detailMessage(error, "We could not open this link."),
          response.status,
        );
      }
      return data;
    },
  });
}

export async function actOnTask(
  token: string,
  taskType: TaskType,
  action: CoordinationAction,
  expectedVersion: number,
  reason?: string,
) {
  const { data, error, response } = await fetchClient.POST(
    "/api/coordination/{token}/tasks/{task_type}",
    {
      params: { path: { token, task_type: taskType } },
      body: {
        action,
        expected_version: expectedVersion,
        reason: reason?.trim() || null,
      },
    },
  );
  if (error || !data) {
    throw new CoordinationError(
      detailMessage(error, "We could not save that."),
      response.status,
    );
  }
  return data;
}
