import { useQuery } from "@tanstack/react-query";
import { viewerQueryOptions } from "@/features/auth/api/viewerQueries";
import { useAuthSession } from "@/features/auth/AuthSessionContext";

export type ViewerRole = "organizer" | "older_adult" | "unknown";

/** The signed-in person's role, or "unknown" while it is still being decided. */
export function useViewer() {
  const { session } = useAuthSession();
  const query = useQuery({ ...viewerQueryOptions(), enabled: Boolean(session) });

  return {
    role: (query.data?.role ?? "unknown") as ViewerRole,
    olderAdultId: query.data?.older_adult_id ?? undefined,
    familyId: query.data?.family_id ?? undefined,
    displayName: query.data?.display_name ?? undefined,
    isPending: Boolean(session) && query.isPending,
    isError: query.isError,
    query,
  };
}
