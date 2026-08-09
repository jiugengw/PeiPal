import { queryOptions } from "@tanstack/react-query";
import { getSupabaseClient } from "@/lib/supabase";
import { environment } from "@/services/environment";

export interface WorkBuddyConnection {
  client_id: string;
  scope: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
}

export class WorkBuddyConnectionError extends Error {}

export const workbuddyConnectionsQueryKey = ["workbuddy-connections"] as const;

async function authenticatedRequest(path: string, init?: RequestInit) {
  const supabase = await getSupabaseClient();
  const { data } = await supabase.auth.getSession();
  const response = await fetch(`${environment.apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(data.session?.access_token
        ? { Authorization: `Bearer ${data.session.access_token}` }
        : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) throw new WorkBuddyConnectionError("The connection could not be updated.");
  return response;
}

export function workbuddyConnectionsQueryOptions() {
  return queryOptions({
    queryKey: workbuddyConnectionsQueryKey,
    queryFn: async () => {
      const response = await authenticatedRequest("/api/workbuddy/connections");
      const payload = (await response.json()) as { connections: WorkBuddyConnection[] };
      return payload.connections;
    },
  });
}

export async function revokeWorkBuddyConnection(clientId: string) {
  await authenticatedRequest(`/api/workbuddy/connections/${encodeURIComponent(clientId)}`, {
    method: "DELETE",
  });
}
