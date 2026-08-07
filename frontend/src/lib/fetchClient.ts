import type { paths } from "@/generated/api";
import createFetchClient, { type Middleware } from "openapi-fetch";
import createClient from "openapi-react-query";
import { getSupabaseClient } from "@/lib/supabase";
import { environment } from "@/services/environment";

const authMiddleware: Middleware = {
  async onRequest({ request }) {
    if (!environment.supabase) return request;

    const supabase = await getSupabaseClient();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) request.headers.set("Authorization", `Bearer ${token}`);
    return request;
  },
};

export function createApiFetchClient(
  fetchImplementation: typeof fetch = globalThis.fetch,
) {
  const client = createFetchClient<paths>({
    baseUrl: environment.apiBaseUrl,
    fetch: fetchImplementation,
  });
  client.use(authMiddleware);
  return client;
}

export const fetchClient = createApiFetchClient();

const api = createClient(fetchClient);

export const useApiQuery = api.useQuery;
export const useApiMutation = api.useMutation;
export const useApiInfiniteQuery = api.useInfiniteQuery;
export const useApiSuspenseQuery = api.useSuspenseQuery;
export const apiQueryOptions = api.queryOptions;
