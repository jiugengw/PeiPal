import { getSupabaseClient } from "@/lib/supabase";

/**
 * Finish a passwordless sign-in with the six-digit code from the email.
 *
 * Older adults often read email on a different device from the one they browse
 * on, and a tapped link can open inside the mail app's own browser and be lost.
 * A typed code crosses devices and browsers, so it is offered alongside the link.
 */
export async function signInWithCode(email: string, code: string): Promise<void> {
  const supabase = await getSupabaseClient();
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim().toLowerCase(),
    token: code.trim(),
    type: "email",
  });
  if (error) throw error;
}
