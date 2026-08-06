import { signOut } from "@/features/auth/signOut";
import { getSupabaseClient } from "@/lib/supabase";

vi.mock("@/lib/supabase", () => ({ getSupabaseClient: vi.fn() }));

describe("signOut", () => {
  it("signs out only the current browser session", async () => {
    const authSignOut = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(getSupabaseClient).mockResolvedValue({
      auth: { signOut: authSignOut },
    } as never);
    await signOut();
    expect(authSignOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("passes logout errors to the caller", async () => {
    const authError = new Error("Logout failed");
    const authSignOut = vi.fn().mockResolvedValue({ error: authError });
    vi.mocked(getSupabaseClient).mockResolvedValue({
      auth: { signOut: authSignOut },
    } as never);
    await expect(signOut()).rejects.toBe(authError);
  });
});
