export interface EnvironmentInput {
  VITE_API_BASE_URL?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  VITE_MCP_URL?: string;
}
export interface Environment {
  apiBaseUrl: string;
  mcpUrl: string;
  supabase?: { url: string; anonKey: string };
}

export function readEnvironment(input: EnvironmentInput): Environment {
  const url = input.VITE_SUPABASE_URL?.trim();
  const anonKey = input.VITE_SUPABASE_ANON_KEY?.trim();
  if (Boolean(url) !== Boolean(anonKey))
    throw new Error(
      "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be provided together.",
    );
  return {
    apiBaseUrl: (input.VITE_API_BASE_URL?.trim() || "").replace(/\/$/, ""),
    mcpUrl: input.VITE_MCP_URL?.trim() || "http://localhost:8001/mcp",
    ...(url && anonKey ? { supabase: { url, anonKey } } : {}),
  };
}

export const environment = readEnvironment(import.meta.env);
