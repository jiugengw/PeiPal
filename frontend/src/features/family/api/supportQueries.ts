import { queryOptions } from "@tanstack/react-query";
import type { components } from "@/generated/api";
import { PlanRequestError } from "@/features/plans/api/planQueries";
import { fetchClient } from "@/lib/fetchClient";

export type SupportOffer = components["schemas"]["SupportOfferResponse"];
export type SupportOfferList = components["schemas"]["SupportOfferListResponse"];
export type SupportType = components["schemas"]["SupportOfferCreate"]["support_type"];

export const supportOffersQueryKey = (planId: number) =>
  ["supportOffers", planId] as const;

function detailMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "detail" in error) {
    const detail = (error as { detail?: unknown }).detail;
    if (typeof detail === "string") return detail;
  }
  return fallback;
}

export function supportOffersQueryOptions(planId: number) {
  return queryOptions({
    queryKey: supportOffersQueryKey(planId),
    queryFn: async () => {
      const { data, error, response } = await fetchClient.GET(
        "/api/plans/{plan_id}/support-offers",
        { params: { path: { plan_id: planId } } },
      );
      if (error || !data) {
        throw new PlanRequestError(
          detailMessage(error, "We could not load the support offers."),
          response.status,
        );
      }
      return data;
    },
  });
}

export async function createSupportOffer(
  planId: number,
  body: components["schemas"]["SupportOfferCreate"],
) {
  const { data, error, response } = await fetchClient.POST(
    "/api/plans/{plan_id}/support-offers",
    { params: { path: { plan_id: planId } }, body },
  );
  if (error || !data) {
    throw new PlanRequestError(
      detailMessage(error, "We could not save this offer."),
      response.status,
    );
  }
  return data;
}

export async function withdrawSupportOffer(offerId: number) {
  const { error, response } = await fetchClient.DELETE(
    "/api/support-offers/{offer_id}",
    { params: { path: { offer_id: offerId } } },
  );
  if (error) {
    throw new PlanRequestError(
      detailMessage(error, "We could not withdraw this offer."),
      response.status,
    );
  }
}
