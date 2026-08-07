import { queryOptions } from "@tanstack/react-query";
import type { components } from "@/generated/api";
import { fetchClient } from "@/lib/fetchClient";

export type Viewer = components["schemas"]["ViewerResponse"];

export const viewerQueryKey = ["viewer"] as const;

/**
 * Who is signed in: the organizer who manages the family, or an older adult who
 * arrived by magic link. Family members never sign in at all.
 */
export function viewerQueryOptions() {
  return queryOptions({
    queryKey: viewerQueryKey,
    queryFn: async () => {
      const { data, error } = await fetchClient.GET("/api/me");
      if (error || !data) throw new Error("We could not identify your account.");
      return data;
    },
  });
}
