import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { CoordinationPage } from "@/features/coordination/CoordinationPage";
import { fetchClient } from "@/lib/fetchClient";
import { createQueryClient } from "@/lib/queryClient";

function coordinationState(overrides: Record<string, unknown> = {}) {
  return {
    plan_status: "coordinating",
    older_adult: "Mary",
    responding_as: "Anna",
    activity: {
      name: "Gentle Yoga",
      start_at: "2030-06-01T09:00:00Z",
      location: "Bishan Community Club",
      info_link: "https://example.com/yoga",
    },
    tasks: [
      { task_type: "approval", status: "open", owner_name: null, decided_by_name: null, reason: null, version: 1 },
      { task_type: "registration", status: "open", owner_name: null, decided_by_name: null, reason: null, version: 1 },
      { task_type: "transport", status: "open", owner_name: null, decided_by_name: null, reason: null, version: 1 },
    ],
    events: [],
    ...overrides,
  };
}

function renderPage() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <CoordinationPage token="test-token" />
    </QueryClientProvider>,
  );
}

describe("CoordinationPage", () => {
  it("blocks registration and transport tasks while the approval task is still open", async () => {
    vi.spyOn(fetchClient, "GET").mockResolvedValueOnce({
      data: coordinationState(),
      response: new Response(null, { status: 200 }),
    } as never);

    renderPage();

    expect(await screen.findByRole("button", { name: /yes, approve/i })).toBeVisible();
    expect(screen.getAllByText(/waiting for the family to approve/i)).toHaveLength(2);
  });

  it("unlocks registration and transport once the approval task is approved", async () => {
    vi.spyOn(fetchClient, "GET").mockResolvedValueOnce({
      data: coordinationState({
        tasks: [
          { task_type: "approval", status: "approved", owner_name: null, decided_by_name: "Anna", reason: null, version: 2 },
          { task_type: "registration", status: "open", owner_name: null, decided_by_name: null, reason: null, version: 1 },
          { task_type: "transport", status: "open", owner_name: null, decided_by_name: null, reason: null, version: 1 },
        ],
      }),
      response: new Response(null, { status: 200 }),
    } as never);

    renderPage();

    await screen.findByText(/anna approved this/i);
    expect(screen.queryByText(/waiting for the family to approve/i)).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /i can do this/i })).toHaveLength(2);
  });

  it("always shows Approval first, regardless of the order the backend returns tasks in", async () => {
    vi.spyOn(fetchClient, "GET").mockResolvedValueOnce({
      data: coordinationState({
        // Deliberately out of order, and with approval already acted on -
        // this is exactly the shape that used to make the approval card
        // jump to the bottom after someone clicked it.
        tasks: [
          { task_type: "transport", status: "open", owner_name: null, decided_by_name: null, reason: null, version: 1 },
          { task_type: "registration", status: "open", owner_name: null, decided_by_name: null, reason: null, version: 1 },
          { task_type: "approval", status: "approved", owner_name: null, decided_by_name: "Anna", reason: null, version: 2 },
        ],
      }),
      response: new Response(null, { status: 200 }),
    } as never);

    renderPage();

    const headings = await screen.findAllByRole("heading", { level: 3 });
    expect(headings.map((heading) => heading.textContent)).toEqual([
      "Approval",
      "Signing up",
      "Getting there",
    ]);
  });
});
