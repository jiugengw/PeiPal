import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DecisionPage } from "@/features/decisions/DecisionPage";
import { fetchClient } from "@/lib/fetchClient";

const invitation = {
  plan_id: 9,
  plan_status: "awaiting_approval",
  family_member: "Anna Lim",
  older_adult: "Mary",
  activity: {
    name: "Chair Yoga",
    location: "Tiong Bahru CC",
    start_at: "2030-06-01T10:00:00Z",
    info_link: "https://example.com/yoga",
  },
  can_decide: true,
};

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <DecisionPage token="token-1" />
    </QueryClientProvider>,
  );
}

function mockInvitation(overrides: Record<string, unknown> = {}) {
  return vi.spyOn(fetchClient, "GET").mockResolvedValue({
    data: { ...invitation, ...overrides },
    response: new Response(null, { status: 200 }),
  } as never);
}

describe("DecisionPage", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows who the plan is for and the activity details", async () => {
    mockInvitation();
    renderPage();

    expect(
      await screen.findByRole("heading", { name: /mary would like to join/i }),
    ).toBeVisible();
    expect(screen.getByRole("heading", { name: /chair yoga/i })).toBeVisible();
    expect(screen.getByText("Tiong Bahru CC")).toBeVisible();
    expect(screen.getByText(/first person to answer decides/i)).toBeVisible();
  });

  it("confirms before recording an approval and reports who decided", async () => {
    const user = userEvent.setup();
    mockInvitation();
    const post = vi.spyOn(fetchClient, "POST").mockResolvedValue({
      data: {
        plan_id: 9,
        status: "approved",
        decided_by: "Anna Lim",
        decided_at: "2030-06-01T10:00:00Z",
        message: "Your decision was recorded and everyone was notified by email.",
        deliveries: [
          { recipient_role: "family_member", name: "Anna Lim", status: "sent" },
        ],
      },
      response: new Response(null, { status: 200 }),
    } as never);
    renderPage();

    await user.click(
      await screen.findByRole("button", { name: /approve this request/i }),
    );
    expect(post).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /yes, approve/i }));

    expect(post).toHaveBeenCalledWith("/api/family-decisions/{token}", {
      params: { path: { token: "token-1" } },
      body: { decision: "approved", reason: null },
    });
    expect(
      await screen.findByRole("heading", { name: /you approved this activity/i }),
    ).toBeVisible();
    expect(screen.getByText("Anna Lim")).toBeVisible();
  });

  it("sends an optional reason with a rejection", async () => {
    const user = userEvent.setup();
    mockInvitation();
    const post = vi.spyOn(fetchClient, "POST").mockResolvedValue({
      data: {
        plan_id: 9,
        status: "rejected",
        decided_by: "Anna Lim",
        decided_at: "2030-06-01T10:00:00Z",
        message: "Your decision was recorded and everyone was notified by email.",
        deliveries: [],
      },
      response: new Response(null, { status: 200 }),
    } as never);
    renderPage();

    await user.click(
      await screen.findByRole("button", { name: /reject this request/i }),
    );
    await user.type(screen.getByLabelText(/anything you would like to add/i), "Too far.");
    await user.click(screen.getByRole("button", { name: /yes, reject/i }));

    expect(post).toHaveBeenCalledWith("/api/family-decisions/{token}", {
      params: { path: { token: "token-1" } },
      body: { decision: "rejected", reason: "Too far." },
    });
  });

  it("explains that someone else already decided", async () => {
    mockInvitation({ can_decide: false, plan_status: "approved" });
    renderPage();

    expect(
      await screen.findByRole("heading", { name: /already been decided/i }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /approve this request/i }),
    ).not.toBeInTheDocument();
  });

  it("explains a losing race instead of showing a raw error", async () => {
    const user = userEvent.setup();
    mockInvitation();
    vi.spyOn(fetchClient, "POST").mockResolvedValue({
      error: { detail: "This plan already has a family decision." },
      response: new Response(null, { status: 409 }),
    } as never);
    renderPage();

    await user.click(
      await screen.findByRole("button", { name: /approve this request/i }),
    );
    await user.click(screen.getByRole("button", { name: /yes, approve/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /someone in the family answered first/i,
    );
  });

  it("explains an expired link", async () => {
    vi.spyOn(fetchClient, "GET").mockResolvedValue({
      error: { detail: "This family decision link has expired." },
      response: new Response(null, { status: 410 }),
    } as never);
    renderPage();

    expect(
      await screen.findByRole("heading", { name: /no longer valid/i }),
    ).toBeVisible();
  });

  it("names recipients that could not be emailed", async () => {
    const user = userEvent.setup();
    mockInvitation();
    vi.spyOn(fetchClient, "POST").mockResolvedValue({
      data: {
        plan_id: 9,
        status: "approved",
        decided_by: "Anna Lim",
        decided_at: "2030-06-01T10:00:00Z",
        message:
          "Your decision was recorded. 1 of 2 people were notified by email; 1 could not be reached and can be retried.",
        deliveries: [
          { recipient_role: "family_member", name: "Anna Lim", status: "sent" },
          { recipient_role: "older_adult", name: "Mary", status: "failed" },
        ],
      },
      response: new Response(null, { status: 200 }),
    } as never);
    renderPage();

    await user.click(
      await screen.findByRole("button", { name: /approve this request/i }),
    );
    await user.click(screen.getByRole("button", { name: /yes, approve/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/could not be reached by email/i);
    expect(alert).toHaveTextContent("Mary");
  });
});
