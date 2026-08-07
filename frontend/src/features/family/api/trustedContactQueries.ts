import { queryOptions } from "@tanstack/react-query";
import type { components } from "@/generated/api";
import { PlanRequestError } from "@/features/plans/api/planQueries";
import { fetchClient } from "@/lib/fetchClient";

export type TrustedContactLink = components["schemas"]["TrustedContactResponse"];

/**
 * NOTE: provisional per team decision on 2026-08-07, mirrors
 * TRUSTED_CONTACT_CONSENT_ACCEPTED in the backend's src/api/dependencies.py.
 * Update both together if this value ever changes.
 */
export const TRUSTED_CONTACT_CONSENT_ACCEPTED = "accepted";

/**
 * Mirrors TRUSTED_CONTACT_ACTOR_PREFIX in the backend's dependencies.py.
 * A trusted contact has no Supabase-linked identity of their own, so the
 * backend attributes their actions (offered_by, approved_by) using this
 * prefix plus their trusted_contacts.id instead of a user UUID. Use
 * trustedContactActorId(contact.id) to build the same value on the frontend
 * for "is this mine" comparisons (e.g. in SupportOfferPanel).
 */
export const TRUSTED_CONTACT_ACTOR_PREFIX = "trusted_contact:";

export function trustedContactActorId(contactId: number): string {
  return `${TRUSTED_CONTACT_ACTOR_PREFIX}${contactId}`;
}

function detailMessage(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "detail" in error) {
    const detail = (error as { detail?: unknown }).detail;
    if (typeof detail === "string") return detail;
  }
  return fallback;
}

export const myTrustedContactLinksQueryKey = ["myTrustedContactLinks"] as const;

/** The trusted-contact records matching the signed-in user's email, across every older adult. */
export function myTrustedContactLinksQueryOptions() {
  return queryOptions({
    queryKey: myTrustedContactLinksQueryKey,
    queryFn: async () => {
      const { data, error, response } = await fetchClient.GET("/api/trusted-contacts/me");
      if (error || !data) {
        throw new PlanRequestError(
          detailMessage(error, "We could not find your trusted-contact links."),
          response.status,
        );
      }
      return data;
    },
  });
}

export const familyPlansQueryKey = (olderAdultId: number) => ["familyPlans", olderAdultId] as const;

/** A trusted contact's view of one older adult's plans - only awaiting_approval and shared. */
export function familyPlansQueryOptions(olderAdultId: number) {
  return queryOptions({
    queryKey: familyPlansQueryKey(olderAdultId),
    queryFn: async () => {
      const { data, error, response } = await fetchClient.GET(
        "/api/older-adults/{older_adult_id}/family-plans",
        { params: { path: { older_adult_id: olderAdultId } } },
      );
      if (error || !data) {
        throw new PlanRequestError(
          detailMessage(error, "We could not load plans for this family portal."),
          response.status,
        );
      }
      return data;
    },
  });
}
