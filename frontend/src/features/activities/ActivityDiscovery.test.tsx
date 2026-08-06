import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActivityDiscovery } from "@/features/activities/ActivityDiscovery";
import { useSetupProgress } from "@/features/setup/useSetupProgress";
import { fetchClient } from "@/lib/fetchClient";
import { createQueryClient } from "@/lib/queryClient";

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useNavigate: () => navigate,
}));

vi.mock("@/features/setup/useSetupProgress", () => ({
  useSetupProgress: vi.fn(),
}));

const mockedProgress = vi.mocked(useSetupProgress);

function activityResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    dedupe_key: "senior-yoga-bishan",
    name: "Senior Yoga",
    location: "Bishan Community Club",
    start_at: "2030-06-01T09:00:00Z",
    currency: "SGD",
    info_link: "https://example.com/senior-yoga",
    cost: 0,
    tags: ["gentle"],
    status: "active",
    first_seen_at: "2029-12-01T00:00:00Z",
    last_seen_at: "2029-12-15T00:00:00Z",
    last_checked_at: "2029-12-15T00:00:00Z",
    ...overrides,
  };
}

function renderPage() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <ActivityDiscovery />
    </QueryClientProvider>,
  );
}

describe("ActivityDiscovery", () => {
  beforeEach(() => {
    navigate.mockReset();
    mockedProgress.mockReturnValue({
      household: {
        id: 1,
        name: "Lim Family",
        created_by: "user-1",
        created_at: "2030-01-01T00:00:00Z",
      },
      olderAdult: {
        id: 2,
        household_id: 1,
        name: "Mary Lim",
        preferred_name: "Mary",
        sharing_mode: "family_approval",
        created_by: "user-1",
        created_at: "2030-01-01T00:00:00Z",
      },
    } as never);
  });

  it("greets the older adult by preferred name and lists activities", async () => {
    vi.spyOn(fetchClient, "GET").mockResolvedValueOnce({
      data: { activities: [activityResponse()] },
      response: new Response(null, { status: 200 }),
    } as never);

    renderPage();

    expect(
      await screen.findByRole("heading", { name: /something new for mary/i }),
    ).toBeVisible();
    expect(await screen.findByText("Senior Yoga")).toBeVisible();
  });

  it("selecting an activity shows it in the detail panel and disables re-choosing it", async () => {
    const user = userEvent.setup();
    vi.spyOn(fetchClient, "GET").mockResolvedValueOnce({
      data: { activities: [activityResponse()] },
      response: new Response(null, { status: 200 }),
    } as never);

    renderPage();

    await user.click(
      await screen.findByRole("button", { name: /choose this activity/i }),
    );

    const panel = screen
      .getByRole("heading", { name: "Senior Yoga", level: 2 })
      .closest("div");
    expect(panel).not.toBeNull();
    expect(
      within(panel as HTMLElement).getByText(/bishan community club/i),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: /^selected$/i })).toBeDisabled();
  });

  it("clears the selection and explains it when the activity disappears from a refreshed result set", async () => {
    const user = userEvent.setup();
    vi.spyOn(fetchClient, "GET")
      .mockResolvedValueOnce({
        data: { activities: [activityResponse()] },
        response: new Response(null, { status: 200 }),
      } as never)
      .mockResolvedValueOnce({
        data: { activities: [] },
        response: new Response(null, { status: 200 }),
      } as never);

    renderPage();
    await user.click(
      await screen.findByRole("button", { name: /choose this activity/i }),
    );
    expect(
      screen.getByRole("button", { name: /^selected$/i }),
    ).toBeInTheDocument();

    await user.type(
      screen.getByLabelText(/search by neighborhood or venue/i),
      "Toa Payoh",
    );
    await user.click(screen.getByRole("button", { name: /^search$/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        /no longer available/i,
      );
    });
    expect(screen.getByText("No activity chosen yet")).toBeVisible();
  });

  it("searching by location requests the filtered results and offers a clear action once empty", async () => {
    const user = userEvent.setup();
    vi.spyOn(fetchClient, "GET").mockResolvedValue({
      data: { activities: [] },
      response: new Response(null, { status: 200 }),
    } as never);

    renderPage();
    await user.type(
      screen.getByLabelText(/search by neighborhood or venue/i),
      "Punggol",
    );
    await user.click(screen.getByRole("button", { name: /^search$/i }));

    expect(
      await screen.findByText(/no activities found near "punggol"/i),
    ).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: /clear location filter/i }),
    );

    expect(
      screen.getByLabelText(/search by neighborhood or venue/i),
    ).toHaveValue("");
  });

  it("reviews the selected activity and creates a plan with its numeric database ID", async () => {
    const user = userEvent.setup();
    vi.spyOn(fetchClient, "GET").mockResolvedValueOnce({
      data: { activities: [activityResponse({ id: 27 })] },
      response: new Response(null, { status: 200 }),
    } as never);
    const post = vi.spyOn(fetchClient, "POST").mockResolvedValueOnce({
      data: {
        id: 9,
        household_id: 1,
        older_adult_id: 2,
        activity_id: 27,
        status: "draft",
        created_by: "user-1",
        created_at: "2030-01-01T00:00:00Z",
        updated_at: "2030-01-01T00:00:00Z",
      },
      response: new Response(null, { status: 201 }),
    } as never);

    renderPage();
    await user.click(await screen.findByRole("button", { name: /choose this activity/i }));
    await user.click(screen.getByRole("button", { name: /make a plan/i }));

    expect(screen.getByRole("heading", { name: /review this plan/i })).toBeVisible();
    await user.click(screen.getByRole("button", { name: /confirm and create plan/i }));

    await waitFor(() => expect(post).toHaveBeenCalledWith("/api/plans", {
      body: { household_id: 1, older_adult_id: 2, activity_id: 27 },
    }));
    expect(navigate).toHaveBeenCalledWith({
      to: "/plans/$planId",
      params: { planId: "9" },
    });
  });

  it("returns to discovery when the selected activity becomes unavailable during creation", async () => {
    const user = userEvent.setup();
    vi.spyOn(fetchClient, "GET").mockResolvedValueOnce({
      data: { activities: [activityResponse()] },
      response: new Response(null, { status: 200 }),
    } as never);
    vi.spyOn(fetchClient, "POST").mockResolvedValueOnce({
      error: { detail: "Active activity not found." },
      response: new Response(null, { status: 404 }),
    } as never);

    renderPage();
    await user.click(await screen.findByRole("button", { name: /choose this activity/i }));
    await user.click(screen.getByRole("button", { name: /make a plan/i }));
    await user.click(screen.getByRole("button", { name: /confirm and create plan/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/active activity not found/i);
    await user.click(screen.getByRole("button", { name: /return to activities/i }));
    expect(screen.getByText(/no activity chosen yet/i)).toBeVisible();
  });
});
