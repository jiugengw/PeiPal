export interface EnvironmentInput {
  VITE_API_BASE_URL?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
}
export interface Environment {
  apiBaseUrl: string;
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
    ...(url && anonKey ? { supabase: { url, anonKey } } : {}),
  };
}

export const environment = readEnvironment(import.meta.env);
