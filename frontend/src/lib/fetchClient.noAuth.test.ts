const { getSupabaseClient } = vi.hoisted(() => ({
  getSupabaseClient: vi.fn(),
}));

vi.mock("@/services/environment", () => ({
  environment: { apiBaseUrl: "https://api.example.test" },
}));

vi.mock("@/lib/supabase", () => ({ getSupabaseClient }));

import { createApiFetchClient } from "@/lib/fetchClient";

describe("fetchClient without Supabase configuration", () => {
  it("does not initialize Supabase or add an authorization header", async () => {
    const fetchImplementation = vi
      .fn()
      .mockResolvedValue(Response.json({ activities: [] }));
    const client = createApiFetchClient(fetchImplementation);

    await client.GET("/api/activities", {
      params: { query: { limit: 3 } },
    });

    const request = fetchImplementation.mock.calls[0]?.[0];
    expect(request).toBeInstanceOf(Request);
    expect((request as Request).headers.has("Authorization")).toBe(false);
    expect(getSupabaseClient).not.toHaveBeenCalled();
  });
});
