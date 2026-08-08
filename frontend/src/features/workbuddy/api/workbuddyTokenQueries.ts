import { queryOptions } from "@tanstack/react-query";
import type { components } from "@/generated/api";
import { fetchClient } from "@/lib/fetchClient";

export type WorkBuddyToken = components["schemas"]["WorkBuddyTokenSummary"];

export class WorkBuddyTokenError extends Error {}

export const workbuddyTokensQueryKey = ["workbuddy-tokens"] as const;

export function workbuddyTokensQueryOptions() {
  return queryOptions({
    queryKey: workbuddyTokensQueryKey,
    queryFn: async () => {
      const { data, error } = await fetchClient.GET("/api/workbuddy/tokens");
      if (error || !data) throw new WorkBuddyTokenError("We could not load your connected apps.");
      return data.tokens;
    },
  });
}

export async function createWorkBuddyToken(name: string) {
  const { data, error } = await fetchClient.POST("/api/workbuddy/tokens", {
    body: { name },
  });
  if (error || !data) throw new WorkBuddyTokenError("We could not create that token.");
  return data;
}

export async function revokeWorkBuddyToken(tokenId: number) {
  const { error } = await fetchClient.DELETE("/api/workbuddy/tokens/{token_id}", {
    params: { path: { token_id: tokenId } },
  });
  if (error) throw new WorkBuddyTokenError("We could not revoke that token.");
}
