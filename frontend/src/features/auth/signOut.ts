import { getSupabaseClient } from "@/lib/supabase";

export async function signOut(): Promise<void> {
  const supabase = await getSupabaseClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });
  if (error) throw error;
}
