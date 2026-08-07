import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PlanDetail } from "@/features/plans/PlanDetail";
import { useSetupProgress } from "@/features/setup/useSetupProgress";
import { fetchClient } from "@/lib/fetchClient";
import { createQueryClient } from "@/lib/queryClient";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="#test">{children}</a>,
}));

vi.mock("@/features/setup/useSetupProgress", () => ({
  useSetupProgress: vi.fn(),
}));

const mockedProgress = vi.mocked(useSetupProgress);

function planResponse(status: "draft" | "coordinating" | "ready" | "cancelled") {
  return {
    id: 9,
    family_id: 1,
    older_adult_id: 2,
    activity_id: 27,
    status,
    created_by: "user-1",
    created_at: "2030-01-01T00:00:00Z",
    updated_at: "2030-01-01T00:00:00Z",
  };
}

function activityResponse() {
  return {
    id: 27,
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
    created_at: "2029-12-01T00:00:00Z",
    updated_at: "2029-12-15T00:00:00Z",
  };
}

function renderPlan() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <PlanDetail planId={9} />
    </QueryClientProvider>,
  );
}

function mockPlanLoad(status: "draft" | "coordinating" | "ready" | "cancelled") {
  return vi.spyOn(fetchClient, "GET")
    .mockResolvedValueOnce({
      data: planResponse(status),
      response: new Response(null, { status: 200 }),
    } as never)
    .mockResolvedValueOnce({
      data: activityResponse(),
      response: new Response(null, { status: 200 }),
    } as never);
}

describe("PlanDetail", () => {
  beforeEach(() => {
    mockedProgress.mockReturnValue({
      olderAdult: {
        id: 2,
        family_id: 1,
        name: "Mary Lim",
        preferred_name: "Mary",
        sharing_mode: "family_approval",
      },
    } as never);
  });

  afterEach(() => vi.restoreAllMocks());

  it("loads the plan and its referenced activity after a refresh", async () => {
    const get = mockPlanLoad("draft");
    renderPlan();

    expect(await screen.findByRole("heading", { name: /a plan for mary/i })).toBeVisible();
    expect(await screen.findByRole("heading", { name: "Senior Yoga" })).toBeVisible();
    expect(get).toHaveBeenCalledWith("/api/activities/{activity_id}", {
      params: { path: { activity_id: 27 } },
    });
  });

  it("asks the whole family in one action", async () => {
    const user = userEvent.setup();
    mockPlanLoad("draft");
    const post = vi.spyOn(fetchClient, "POST").mockResolvedValueOnce({
      data: {
        plan_id: 9,
        plan_status: "coordinating",
        deliveries: [
          { recipient_role: "family_member", name: "Anna Lim", status: "sent" },
        ],
        message: "Your whole family has been asked.",
      },
      response: new Response(null, { status: 200 }),
    } as never);
    renderPlan();

    await user.click(await screen.findByRole("button", { name: /ask my family/i }));

    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/api/plans/{plan_id}/coordination", {
        params: { path: { plan_id: 9 } },
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      /whole family has been asked/i,
    );
  });

  it("says plainly when nobody could be emailed", async () => {
    const user = userEvent.setup();
    mockPlanLoad("draft");
    vi.spyOn(fetchClient, "POST").mockResolvedValueOnce({
      data: {
        plan_id: 9,
        plan_status: "coordinating",
        deliveries: [
          { recipient_role: "family_member", name: "Anna Lim", status: "failed" },
        ],
        message: "Nobody could be emailed. You can try again once email is working.",
      },
      response: new Response(null, { status: 200 }),
    } as never);
    renderPlan();

    await user.click(await screen.findByRole("button", { name: /ask my family/i }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      /nobody could be emailed/i,
    );
  });

  it("requires confirmation before cancelling an active plan", async () => {
    const user = userEvent.setup();
    mockPlanLoad("ready");
    const patch = vi.spyOn(fetchClient, "PATCH").mockResolvedValueOnce({
      data: planResponse("cancelled"),
      response: new Response(null, { status: 200 }),
    } as never);
    renderPlan();

    await user.click(await screen.findByRole("button", { name: /^cancel plan$/i }));
    expect(patch).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /confirm cancellation/i }));

    await waitFor(() => expect(patch).toHaveBeenCalledWith("/api/plans/{plan_id}", {
      params: { path: { plan_id: 9 } },
      body: { status: "cancelled" },
    }));
    expect(await screen.findByRole("heading", { name: /^cancelled$/i })).toBeVisible();
  });

  it("refetches and explains a stale lifecycle conflict", async () => {
    const user = userEvent.setup();
    mockPlanLoad("ready").mockResolvedValueOnce({
      data: planResponse("cancelled"),
      response: new Response(null, { status: 200 }),
    } as never);
    vi.spyOn(fetchClient, "PATCH").mockResolvedValueOnce({
      error: { detail: "Cannot change a plan from cancelled to cancelled." },
      response: new Response(null, { status: 409 }),
    } as never);
    renderPlan();

    await user.click(await screen.findByRole("button", { name: /^cancel plan$/i }));
    await user.click(screen.getByRole("button", { name: /confirm cancellation/i }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      /changed elsewhere/i,
    );
  });
});
