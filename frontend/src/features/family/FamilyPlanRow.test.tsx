import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FamilyPlanRow } from "@/features/family/FamilyPlanRow";
import { fetchClient } from "@/lib/fetchClient";

vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children: ReactNode }) => <a href="#test">{children}</a> }));
vi.mock("@/features/family/SupportOfferPanel", () => ({ SupportOfferPanel: () => <div>Support controls</div> }));

function planResponse(status: "coordinating" | "ready" | "cancelled") {
  return { id: 9, family_id: 1, older_adult_id: 2, activity_id: 27, status, created_by: "user-1", created_at: "2030-01-01T00:00:00Z", updated_at: "2030-01-01T00:00:00Z" };
}

const activity = { id: 27, dedupe_key: "yoga", name: "Senior Yoga", location: "Bishan", start_at: "2030-06-01T09:00:00Z", currency: "SGD", info_link: "https://example.com", status: "active", first_seen_at: "2030-01-01T00:00:00Z", last_seen_at: "2030-01-01T00:00:00Z", last_checked_at: "2030-01-01T00:00:00Z", created_at: "2030-01-01T00:00:00Z", updated_at: "2030-01-01T00:00:00Z" };

function renderRow(status: "coordinating" | "ready" = "coordinating") {
  vi.spyOn(fetchClient, "GET").mockResolvedValue({ data: activity, response: new Response(null, { status: 200 }) } as never);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><FamilyPlanRow plan={planResponse(status)} olderAdultName="Mary" /></QueryClientProvider>);
}

describe("FamilyPlanRow", () => {
  afterEach(() => vi.restoreAllMocks());

  it("offers no decision buttons while the family is still deciding", async () => {
    renderRow();

    expect(await screen.findByText(/first person to answer decides/i)).toBeVisible();
    expect(screen.queryByRole("button", { name: /approve/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reject/i })).not.toBeInTheDocument();
  });

  it("requires confirmation before cancelling", async () => {
    const user = userEvent.setup();
    const patch = vi.spyOn(fetchClient, "PATCH").mockResolvedValue({ data: planResponse("cancelled"), response: new Response(null, { status: 200 }) } as never);
    renderRow();

    await user.click(await screen.findByRole("button", { name: /^cancel plan$/i }));
    expect(patch).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /confirm cancellation/i }));

    await waitFor(() => expect(patch).toHaveBeenCalledWith("/api/plans/{plan_id}", { params: { path: { plan_id: 9 } }, body: { status: "cancelled" } }));
  });
});
