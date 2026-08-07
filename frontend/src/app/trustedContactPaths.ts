// Pages a trusted contact is actually allowed to reach. Everything else
// under _authenticated is a household-side page that assumes a household
// exists and would otherwise show a broken or empty state.
export function isTrustedContactPath(pathname: string) {
  return pathname === "/family-portal" || pathname.startsWith("/plans/");
}
