import type { ViewerRole } from "@/hooks/useViewer";

/**
 * The organizer's account exists to build and correct the family. The older
 * adult's account is the one used day to day. Keeping each to its own pages
 * stops either landing somewhere that assumes the other's data.
 */
const ORGANIZER_PATHS = ["/setup"];
const OLDER_ADULT_PATHS = ["/discover", "/plans", "/family"];

export function homePathFor(role: ViewerRole) {
  return role === "older_adult" ? "/discover" : "/setup";
}

function matches(paths: string[], pathname: string) {
  return paths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

/**
 * Only redirect away from pages the signed-in role cannot use. An unresolved
 * authenticated account is kept on setup until the backend identifies it.
 */
export function canReach(role: ViewerRole, pathname: string) {
  // An authenticated account without a resolved role is still in the setup
  // handoff. Keep it on the organizer-facing setup page until the backend can
  // identify it; otherwise a fresh account could deep-link into older-adult
  // pages before it has been provisioned.
  if (role === "unknown") return pathname === "/setup" || pathname.startsWith("/setup/");
  const forbidden = role === "older_adult" ? ORGANIZER_PATHS : OLDER_ADULT_PATHS;
  return !matches(forbidden, pathname);
}
