import { getSupabaseClient } from "@/lib/supabase";
import { signUp } from "@/features/auth/signUp";

vi.mock("@/lib/supabase", () => ({ getSupabaseClient: vi.fn() }));

describe("signUp", () => {
  it("sends credentials and full-name metadata to Supabase", async () => {
    const authSignUp = vi
      .fn()
      .mockResolvedValue({ data: { session: null }, error: null });
    vi.mocked(getSupabaseClient).mockResolvedValue({
      auth: { signUp: authSignUp },
    } as never);
    await expect(
      signUp({
        fullName: "Mary Lim",
        email: "mary@example.com",
        password: "safe-passphrase",
      }),
    ).resolves.toEqual({ confirmationRequired: true });
    expect(authSignUp).toHaveBeenCalledWith({
      email: "mary@example.com",
      password: "safe-passphrase",
      options: {
        data: { full_name: "Mary Lim" },
        emailRedirectTo: `${window.location.origin}/auth`,
      },
    });
  });

  it("passes Supabase signup errors to the caller", async () => {
    const providerError = new Error("Signup failed");
    const authSignUp = vi
      .fn()
      .mockResolvedValue({ data: { session: null }, error: providerError });
    vi.mocked(getSupabaseClient).mockResolvedValue({
      auth: { signUp: authSignUp },
    } as never);
    await expect(
      signUp({
        fullName: "Mary Lim",
        email: "mary@example.com",
        password: "safe-passphrase",
      }),
    ).rejects.toBe(providerError);
  });
});
