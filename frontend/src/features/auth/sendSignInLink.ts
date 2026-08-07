import { getSupabaseClient } from "@/lib/supabase";

/**
 * Send a magic sign-in link. Older adults never hold a password: their email
 * address is their login, and possession of the inbox is the proof.
 *
 * `shouldCreateUser` is true so the very first link also creates their account.
 * The backend then matches that account to an older-adult profile by address.
 */
export async function sendSignInLink(email: string): Promise<void> {
  const supabase = await getSupabaseClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${window.location.origin}/`,
    },
  });
  if (error) throw error;
}
