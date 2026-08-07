const { getSession } = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

vi.mock("@/services/environment", () => ({
  environment: {
    apiBaseUrl: "https://api.example.test",
    supabase: { url: "https://supabase.example.test", anonKey: "public-key" },
  },
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseClient: vi.fn(async () => ({ auth: { getSession } })),
}));

import { createApiFetchClient } from "@/lib/fetchClient";

function requestFromFetchCall(fetchImplementation: ReturnType<typeof vi.fn>) {
  const request = fetchImplementation.mock.calls[0]?.[0];
  if (!(request instanceof Request))
    throw new Error("Expected fetch to receive a Request.");
  return request;
}

describe("fetchClient", () => {
  beforeEach(() => {
    getSession.mockResolvedValue({ data: { session: null } });
  });

  it("adds the current Supabase access token", async () => {
    getSession.mockResolvedValue({
      data: { session: { access_token: "access-token" } },
    });
    const fetchImplementation = vi
      .fn()
      .mockResolvedValue(Response.json({ activities: [] }));
    const client = createApiFetchClient(fetchImplementation);

    await client.GET("/api/activities", {
      params: { query: { location: "Bishan", limit: 5 } },
    });

    const request = requestFromFetchCall(fetchImplementation);
    expect(request.headers.get("Authorization")).toBe("Bearer access-token");
    expect(request.url).toBe(
      "https://api.example.test/api/activities?location=Bishan&limit=5",
    );
  });

  it("omits the authorization header when there is no session", async () => {
    const fetchImplementation = vi
      .fn()
      .mockResolvedValue(Response.json({ activities: [] }));
    const client = createApiFetchClient(fetchImplementation);

    await client.GET("/api/activities", {
      params: { query: { limit: 3 } },
    });

    expect(
      requestFromFetchCall(fetchImplementation).headers.has("Authorization"),
    ).toBe(false);
  });

  it("serializes typed request bodies and path parameters", async () => {
    const fetchImplementation = vi
      .fn()
      .mockResolvedValue(Response.json({ id: 7 }));
    const client = createApiFetchClient(fetchImplementation);

    await client.PATCH("/api/families/{family_id}", {
      params: { path: { family_id: 7 } },
      body: { name: "Lim Family" },
    });

    const request = requestFromFetchCall(fetchImplementation);
    expect(request.method).toBe("PATCH");
    expect(request.url).toBe("https://api.example.test/api/families/7");
    expect(await request.json()).toEqual({ name: "Lim Family" });
  });

  it("handles a no-content response", async () => {
    const fetchImplementation = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    const client = createApiFetchClient(fetchImplementation);

    const result = await client.DELETE("/api/family-members/{family_member_id}", {
      params: { path: { family_member_id: 9 } },
    });

    expect(result.data).toBeUndefined();
    expect(result.error).toBeUndefined();
    expect(result.response.status).toBe(204);
  });

  it("returns structured API errors with the response status", async () => {
    const fetchImplementation = vi
      .fn()
      .mockResolvedValue(
        Response.json(
          { detail: "The family was not found." },
          { status: 404 },
        ),
      );
    const client = createApiFetchClient(fetchImplementation);

    const result = await client.GET("/api/families/{family_id}", {
      params: { path: { family_id: 404 } },
    });

    expect(result.data).toBeUndefined();
    expect(result.error).toEqual({ detail: "The family was not found." });
    expect(result.response.status).toBe(404);
  });
});
