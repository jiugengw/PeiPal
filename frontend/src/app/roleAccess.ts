import type { ViewerRole } from "@/hooks/useViewer";

/**
 * The organizer's account exists to build and correct the family. The older
 * adult's account is the one used day to day. Keeping each to its own pages
 * stops either landing somewhere that assumes the other's data.
 */
const ORGANIZER_PATHS = ["/discover", "/plans"];
const OLDER_ADULT_PATHS = ["/setup"];

export function homePathFor(role: ViewerRole) {
  return role === "older_adult" ? "/discover" : "/family";
}

function matches(paths: string[], pathname: string) {
  return paths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

/**
 * Only redirect away from pages the signed-in role cannot use.
 *
 * "unknown" covers a brand-new organizer too: GET /me only resolves to
 * "organizer" once they own a family, so someone who just signed up and has
 * not created one yet is "unknown" - the same account, mid-onboarding, not a
 * different kind of user. It is treated exactly like "organizer" here so
 * that account can still reach /family (to see the empty state and add
 * their first family) and /setup (to actually create it), while staying
 * blocked from the older-adult-only pages until a role is confirmed.
 */
export function canReach(role: ViewerRole, pathname: string) {
  const forbidden = role === "older_adult" ? OLDER_ADULT_PATHS : ORGANIZER_PATHS;
  return !matches(forbidden, pathname);
}
