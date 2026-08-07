import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationPanel } from "@/features/notifications/NotificationPanel";
import { fetchClient } from "@/lib/fetchClient";
import { StagedIntentHarness } from "@/test/StagedIntentHarness";

const contacts = [
  { id: 1, older_adult_id: 2, name: "Anna Lim", relationship: "Daughter", email: "anna@example.com", consent_status: "pending", created_at: "2030-01-01T00:00:00Z" },
  { id: 2, older_adult_id: 2, name: "David Lim", relationship: "Son", email: "david@example.com", consent_status: "pending", created_at: "2030-01-01T00:00:00Z" },
  { id: 3, older_adult_id: 2, name: "Mei Tan", relationship: "Friend", email: null, consent_status: "pending", created_at: "2030-01-01T00:00:00Z" },
];

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><NotificationPanel planId={9} contacts={contacts} /></QueryClientProvider>);
}

function mockHistory(notifications: unknown[] = []) {
  return vi.spyOn(fetchClient, "GET").mockResolvedValue({
    data: { notifications },
    response: new Response(null, { status: 200 }),
  } as never);
}

describe("NotificationPanel", () => {
  afterEach(() => vi.restoreAllMocks());

  it("disables contacts without email and contacts already sent", async () => {
    mockHistory([{ id: 10, plan_id: 9, trusted_contact_id: 1, recipient_name: "Anna Lim", status: "sent", created_at: "2030-01-01T00:00:00Z", updated_at: "2030-01-01T00:00:00Z" }]);
    renderPanel();

    expect(await screen.findByRole("checkbox", { name: /anna lim/i })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: /mei tan/i })).toBeDisabled();
    expect(screen.getByText(/email already sent/i)).toBeVisible();
    expect(screen.getByText(/no email address saved/i)).toBeVisible();
  });

  it("requires confirmation and sends only selected contact ids", async () => {
    const user = userEvent.setup();
    mockHistory();
    const post = vi.spyOn(fetchClient, "POST").mockResolvedValue({
      data: { deliveries: [{ contact_id: 1, name: "Anna Lim", status: "sent" }] },
      response: new Response(null, { status: 200 }),
    } as never);
    renderPanel();

    await user.click(await screen.findByRole("checkbox", { name: /anna lim/i }));
    await user.click(screen.getByRole("button", { name: /review email recipients/i }));
    expect(post).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: /send this plan to anna lim/i })).toBeVisible();
    await user.click(screen.getByRole("button", { name: /send plan emails/i }));

    await waitFor(() => expect(post).toHaveBeenCalledWith("/api/plans/{plan_id}/notifications", {
      params: { path: { plan_id: 9 } },
      body: { contact_ids: [1] },
    }));
    expect(await screen.findByText("Email sent")).toBeVisible();
  });

  it("reports partial delivery without showing global success", async () => {
    const user = userEvent.setup();
    mockHistory();
    vi.spyOn(fetchClient, "POST").mockResolvedValue({
      data: { deliveries: [
        { contact_id: 1, name: "Anna Lim", status: "sent" },
        { contact_id: 2, name: "David Lim", status: "failed", error: "Email delivery failed." },
      ] },
      response: new Response(null, { status: 200 }),
    } as never);
    renderPanel();

    await user.click(await screen.findByRole("checkbox", { name: /anna lim/i }));
    await user.click(screen.getByRole("checkbox", { name: /david lim/i }));
    await user.click(screen.getByRole("button", { name: /review email recipients/i }));
    await user.click(screen.getByRole("button", { name: /send plan emails/i }));

    expect(await screen.findByRole("heading", { name: /some emails need another try/i })).toBeVisible();
    expect(screen.queryByText(/email delivery complete/i)).not.toBeInTheDocument();
    expect(screen.getByText("Could not send")).toBeVisible();
  });

  it("retries only contacts with failed history", async () => {
    const user = userEvent.setup();
    mockHistory([
      { id: 10, plan_id: 9, trusted_contact_id: 1, recipient_name: "Anna Lim", status: "sent", created_at: "2030-01-01T00:00:00Z", updated_at: "2030-01-01T00:00:00Z" },
      { id: 11, plan_id: 9, trusted_contact_id: 2, recipient_name: "David Lim", status: "failed", created_at: "2030-01-01T00:00:00Z", updated_at: "2030-01-01T00:00:00Z" },
    ]);
    const post = vi.spyOn(fetchClient, "POST").mockResolvedValue({ data: { deliveries: [{ contact_id: 2, name: "David Lim", status: "sent" }] }, response: new Response(null, { status: 200 }) } as never);
    renderPanel();

    await user.click(await screen.findByRole("button", { name: /retry failed emails/i }));
    expect(screen.getByRole("heading", { name: /send this plan to david lim/i })).toBeVisible();
    await user.click(screen.getByRole("button", { name: /send plan emails/i }));

    await waitFor(() => expect(post).toHaveBeenCalledWith("/api/plans/{plan_id}/notifications", {
      params: { path: { plan_id: 9 } },
      body: { contact_ids: [2] },
    }));
  });

  describe("when the companion has staged recipients", () => {
    function renderStaged(contactIds: number[], planId = 9) {
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      return render(
        <QueryClientProvider client={queryClient}>
          <StagedIntentHarness
            intent={{ id: "intent-1", path: "/plans/9", kind: "select_notification_recipients", planId, contactIds }}
          >
            <NotificationPanel planId={9} contacts={contacts} />
          </StagedIntentHarness>
        </QueryClientProvider>,
      );
    }

    it("ticks the named contacts and opens the review block", async () => {
      mockHistory();
      renderStaged([1, 2]);

      expect(await screen.findByRole("checkbox", { name: /anna lim/i })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: /david lim/i })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: /mei tan/i })).not.toBeChecked();
      expect(screen.getByRole("heading", { name: /send this plan to anna lim and david lim/i })).toBeVisible();
    });

    it("ignores a contact who cannot be emailed", async () => {
      mockHistory();
      renderStaged([1, 3]);

      expect(await screen.findByRole("checkbox", { name: /anna lim/i })).toBeChecked();
      expect(screen.getByRole("checkbox", { name: /mei tan/i })).not.toBeChecked();
      expect(screen.getByRole("heading", { name: /send this plan to anna lim\?/i })).toBeVisible();
    });

    it("sends the same request when confirmed by voice as by button", async () => {
      const user = userEvent.setup();
      mockHistory();
      const post = vi.spyOn(fetchClient, "POST").mockResolvedValue({
        data: { deliveries: [{ contact_id: 1, name: "Anna Lim", status: "sent" }] },
        response: new Response(null, { status: 200 }),
      } as never);
      renderStaged([1]);

      await screen.findByRole("heading", { name: /send this plan to anna lim/i });
      await user.click(screen.getByRole("button", { name: /harness confirm/i }));

      await waitFor(() => expect(post).toHaveBeenCalledWith("/api/plans/{plan_id}/notifications", {
        params: { path: { plan_id: 9 } },
        body: { contact_ids: [1] },
      }));
    });

    it("leaves another plan's panel untouched", async () => {
      mockHistory();
      renderStaged([1, 2], 12);

      expect(await screen.findByRole("checkbox", { name: /anna lim/i })).not.toBeChecked();
      expect(screen.getByRole("button", { name: /review email recipients/i })).toBeDisabled();
    });
  });
});
