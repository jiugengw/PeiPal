import type { components } from "@/generated/api";
import type { Activity } from "@/features/activities/types";

type ActivityResponse = components["schemas"]["ActivityResponse"];

function parseDate(value?: string | null): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Converts a backend activity record into the frontend view model.
 * `databaseId` must be sent as `activity_id` when creating a plan; `dedupeKey`
 * is only a stable list/selection identity and must never be sent as the ID.
 */
export function toActivity(response: ActivityResponse): Activity {
  return {
    databaseId: response.id,
    dedupeKey: response.dedupe_key,
    title: response.name,
    venue: response.location,
    startsAt: parseDate(response.start_at),
    endsAt: parseDate(response.end_at),
    cost: response.cost ?? null,
    currency: response.currency,
    priceRemarks: response.price_remarks ?? null,
    description: response.description ?? "",
    tags: response.tags ?? [],
    mobilityNotes: response.mobility_notes ?? null,
    slotsAvailability: response.slots_availability ?? null,
    infoLink: response.info_link ?? null,
    signupLink: response.signup_link ?? null,
  };
}
