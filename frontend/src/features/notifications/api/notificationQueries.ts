import { queryOptions } from "@tanstack/react-query";
import type { components } from "@/generated/api";
import { PlanRequestError } from "@/features/plans/api/planQueries";
import { fetchClient } from "@/lib/fetchClient";

export type PlanNotification = components["schemas"]["PlanNotificationResponse"];
export type NotificationDelivery = components["schemas"]["NotificationDeliveryResponse"];

export const notificationsQueryKey = (planId: number) =>
  ["notifications", planId] as const;

function detailMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "detail" in error) {
    const detail = (error as { detail?: unknown }).detail;
    if (typeof detail === "string") return detail;
  }
  return fallback;
}

export function notificationsQueryOptions(planId: number) {
  return queryOptions({
    queryKey: notificationsQueryKey(planId),
    queryFn: async () => {
      const { data, error, response } = await fetchClient.GET(
        "/api/plans/{plan_id}/notifications",
        { params: { path: { plan_id: planId } } },
      );
      if (error || !data) {
        throw new PlanRequestError(
          detailMessage(error, "We could not load the email history."),
          response.status,
        );
      }
      return data;
    },
  });
}

export async function sendPlanNotifications(
  planId: number,
  contactIds: number[],
) {
  const { data, error, response } = await fetchClient.POST(
    "/api/plans/{plan_id}/notifications",
    {
      params: { path: { plan_id: planId } },
      body: { family_member_ids: contactIds },
    },
  );
  if (error || !data) {
    throw new PlanRequestError(
      detailMessage(error, "We could not send these emails."),
      response.status,
    );
  }
  return data;
}
