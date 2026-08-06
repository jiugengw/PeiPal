import type { SupabaseClient } from "@supabase/supabase-js";
import { environment } from "@/services/environment";

let clientPromise: Promise<SupabaseClient> | undefined;

export class SupabaseConfigurationError extends Error {
  constructor() {
    super("Supabase browser credentials are not configured.");
    this.name = "SupabaseConfigurationError";
  }
}

export function getSupabaseClient(): Promise<SupabaseClient> {
  const config = environment.supabase;
  if (!config) throw new SupabaseConfigurationError();
  clientPromise ??= import("@supabase/supabase-js").then(({ createClient }) =>
    createClient(config.url, config.anonKey),
  );
  return clientPromise;
}
