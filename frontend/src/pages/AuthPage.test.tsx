import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AppProviders } from "@/app/providers/AppProviders";
import { getSupabaseClient } from "@/lib/supabase";
import { AuthPage } from "@/pages/AuthPage";

vi.mock("@/services/environment", () => ({
  environment: {
    apiBaseUrl: "",
    supabase: { url: "https://example.supabase.co", anonKey: "public-key" },
  },
}));
vi.mock("@/lib/supabase", () => ({ getSupabaseClient: vi.fn() }));

describe("AuthPage", () => {
  it("redirects an authenticated session to setup", async () => {
    let authCallback:
      | ((event: AuthChangeEvent, session: Session | null) => void)
      | undefined;
    const unsubscribe = vi.fn();
    vi.mocked(getSupabaseClient).mockResolvedValue({
      auth: {
        onAuthStateChange: vi.fn((callback) => {
          authCallback = callback;
          return { data: { subscription: { unsubscribe } } };
        }),
      },
    } as never);

    render(
      <AppProviders>
        <MemoryRouter initialEntries={["/auth"]}>
          <Routes>
            <Route path="auth" element={<AuthPage />} />
            <Route path="setup" element={<h1>Setup destination</h1>} />
          </Routes>
        </MemoryRouter>
      </AppProviders>,
    );

    await vi.waitFor(() => expect(authCallback).toBeDefined());
    act(() => authCallback?.("SIGNED_IN", { access_token: "token" } as Session));
    expect(
      await screen.findByRole("heading", { name: /setup destination/i }),
    ).toBeVisible();
  });
});
