import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SupportOfferPanel } from "@/features/family/SupportOfferPanel";
import { fetchClient } from "@/lib/fetchClient";
import { StagedIntentHarness } from "@/test/StagedIntentHarness";

function offer(overrides = {}) {
  return {
    id: 4,
    plan_id: 9,
    offered_by: "user-1",
    support_type: "transport",
    note: "I can drive.",
    status: "offered",
    created_at: "2030-01-01T00:00:00Z",
    updated_at: "2030-01-01T00:00:00Z",
    ...overrides,
  };
}

function renderPanel() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><SupportOfferPanel planId={9} userId="user-1" /></QueryClientProvider>);
}

function mockOffers(supportOffers: unknown[] = []) {
  return vi.spyOn(fetchClient, "GET").mockResolvedValue({ data: { support_offers: supportOffers }, response: new Response(null, { status: 200 }) } as never);
}

describe("SupportOfferPanel", () => {
  afterEach(() => vi.restoreAllMocks());

  it("confirms and creates an offer with its optional note", async () => {
    const user = userEvent.setup();
    mockOffers();
    const post = vi.spyOn(fetchClient, "POST").mockResolvedValue({ data: offer(), response: new Response(null, { status: 201 }) } as never);
    renderPanel();

    await user.click(await screen.findByRole("radio", { name: /help with transport/i }));
    await user.type(screen.getByLabelText(/optional note/i), "I can drive.");
    await user.click(screen.getByRole("button", { name: /review this offer/i }));
    expect(post).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /offer this help/i }));

    await waitFor(() => expect(post).toHaveBeenCalledWith("/api/plans/{plan_id}/support-offers", {
      params: { path: { plan_id: 9 } },
      body: { support_type: "transport", note: "I can drive." },
    }));
    expect(await screen.findByRole("status")).toHaveTextContent(/you offered to help with transport/i);
    expect(screen.getByRole("radio", { name: /help with transport.*you offered/i })).toBeDisabled();
  });

  it("disables an active duplicate and reports a conflict", async () => {
    const user = userEvent.setup();
    mockOffers([offer()]);
    renderPanel();

    expect(await screen.findByRole("radio", { name: /help with transport.*you offered/i })).toBeDisabled();
    await user.click(screen.getByRole("radio", { name: /go together/i }));
    await user.click(screen.getByRole("button", { name: /review this offer/i }));
    vi.spyOn(fetchClient, "POST").mockResolvedValue({ error: { detail: "You already offered this type of support." }, response: new Response(null, { status: 409 }) } as never);
    await user.click(screen.getByRole("button", { name: /offer this help/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not update the support offer/i);
  });

  it("requires confirmation before withdrawal and enables the type afterward", async () => {
    const user = userEvent.setup();
    mockOffers([offer()]);
    const remove = vi.spyOn(fetchClient, "DELETE").mockResolvedValue({ response: new Response(null, { status: 204 }) } as never);
    renderPanel();

    await user.click(await screen.findByRole("button", { name: /^withdraw$/i }));
    expect(remove).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /confirm withdrawal/i }));

    await waitFor(() => expect(remove).toHaveBeenCalledWith("/api/support-offers/{offer_id}", { params: { path: { offer_id: 4 } } }));
    expect(await screen.findByRole("status")).toHaveTextContent(/offer was withdrawn/i);
    expect(screen.getByRole("radio", { name: /^help with transport$/i })).toBeEnabled();
  });

  describe("when the companion has staged an offer", () => {
    function renderStaged(note = "") {
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      return render(
        <QueryClientProvider client={queryClient}>
          <StagedIntentHarness
            intent={{ id: "intent-1", path: "/family", kind: "offer_support", planId: 9, supportType: "transport", note }}
          >
            <SupportOfferPanel planId={9} userId="user-1" />
          </StagedIntentHarness>
        </QueryClientProvider>,
      );
    }

    it("fills in the offer and opens its review block", async () => {
      mockOffers();
      renderStaged("I can drive.");

      expect(await screen.findByRole("radio", { name: /help with transport/i })).toBeChecked();
      expect(screen.getByLabelText(/optional note/i)).toHaveValue("I can drive.");
      expect(screen.getByRole("heading", { name: /offer to help with transport\?/i })).toBeVisible();
    });

    it("saves the same offer when confirmed by voice as by button", async () => {
      const user = userEvent.setup();
      mockOffers();
      const post = vi.spyOn(fetchClient, "POST").mockResolvedValue({ data: offer(), response: new Response(null, { status: 201 }) } as never);
      renderStaged("I can drive.");

      await screen.findByRole("heading", { name: /offer to help with transport\?/i });
      await user.click(screen.getByRole("button", { name: /harness confirm/i }));

      await waitFor(() => expect(post).toHaveBeenCalledWith("/api/plans/{plan_id}/support-offers", {
        params: { path: { plan_id: 9 } },
        body: { support_type: "transport", note: "I can drive." },
      }));
    });

    it("does not re-offer a kind of help already given", async () => {
      mockOffers([offer()]);
      renderStaged();

      expect(await screen.findByRole("radio", { name: /help with transport/i })).toBeDisabled();
      expect(screen.queryByRole("heading", { name: /offer to help with transport\?/i })).not.toBeInTheDocument();
    });
  });
});
