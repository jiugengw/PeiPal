import { useQuery } from "@tanstack/react-query";
import {
  myTrustedContactLinksQueryOptions,
  TRUSTED_CONTACT_CONSENT_ACCEPTED,
  type TrustedContactLink,
} from "@/features/family/api/trustedContactQueries";
import { useSetupProgress } from "@/features/setup/useSetupProgress";

export type ViewerRole = "household" | "trusted_contact" | "unknown";

/**
 * Determines which kind of portal the signed-in user should see.
 *
 * Household membership takes priority (the primary flow); the
 * trusted-contact check only runs once we know there is no household, so a
 * normal household member never pays for the extra request. "unknown"
 * covers a brand-new account (no household yet) or an invite that has not
 * been accepted yet - both fall back to the existing /setup flow.
 */
export function useViewerRole(enabled: boolean = true) {
  const setup = useSetupProgress(enabled);
  const hasHousehold = Boolean(setup.household);

  const linksQuery = useQuery({
    ...myTrustedContactLinksQueryOptions(),
    enabled: enabled && !setup.isPending && !setup.isError && !hasHousehold,
  });

  const acceptedLinks: TrustedContactLink[] = (linksQuery.data?.trusted_contacts ?? []).filter(
    (link) => link.consent_status === TRUSTED_CONTACT_CONSENT_ACCEPTED,
  );

  const isPending = setup.isPending || (!hasHousehold && !setup.isError && linksQuery.isPending);
  const isError = setup.isError || (!hasHousehold && linksQuery.isError);

  let role: ViewerRole = "unknown";
  if (!isPending && !isError) {
    role = hasHousehold ? "household" : acceptedLinks.length > 0 ? "trusted_contact" : "unknown";
  }

  return { role, setup, acceptedLinks, linksQuery, isPending, isError };
}
