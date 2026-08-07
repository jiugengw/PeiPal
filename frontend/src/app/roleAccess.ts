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
 * Only redirect away from a page that belongs to the *other* role. An unknown
 * path is left alone so the router can still show its not-found page, and an
 * unknown role is left alone so a redirect never races the check that decides it.
 */
export function canReach(role: ViewerRole, pathname: string) {
  if (role === "unknown") return true;
  const forbidden = role === "older_adult" ? ORGANIZER_PATHS : OLDER_ADULT_PATHS;
  return !matches(forbidden, pathname);
}
