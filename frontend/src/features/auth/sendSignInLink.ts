import { fetchClient } from "@/lib/fetchClient";

/**
 * Ask PeiPal to email an older adult a sign-in code.
 *
 * Supabase still owns the session, but it does not send the message: the code
 * is generated through the admin API and delivered by PeiPal's own email, so
 * every message comes from one address and Supabase's low mail rate limit never
 * applies. Only an address already added as an older adult receives one.
 */
export async function sendSignInLink(email: string): Promise<void> {
  const { error } = await fetchClient.POST("/api/auth/sign-in-code", {
    body: { email: email.trim().toLowerCase() },
  });
  if (error) {
    const detail =
      error && typeof error === "object" && "detail" in error
        ? (error as { detail?: unknown }).detail
        : undefined;
    throw new Error(
      typeof detail === "string"
        ? detail
        : "We could not send that code. Check the address and try again.",
    );
  }
}
