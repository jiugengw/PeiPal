import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FamilyPortal } from "@/features/family/FamilyPortal";
import { useViewerRole } from "@/hooks/useViewerRole";
import { fetchClient } from "@/lib/fetchClient";

vi.mock("@/hooks/useViewerRole", () => ({ useViewerRole: vi.fn() }));
vi.mock("@/features/family/FamilyPlanRow", () => ({
  FamilyPlanRow: ({ plan, userId }: { plan: { id: number; status: string }; userId?: string }) => (
    <p>
      Plan {plan.id}: {plan.status} (as {userId})
    </p>
  ),
}));

function plan(id: number, olderAdultId: number, status: string) {
  return {
    id,
    household_id: 1,
    older_adult_id: olderAdultId,
    activity_id: id + 20,
    status,
    created_by: "user-1",
    created_at: "2030-01-01T00:00:00Z",
    updated_at: "2030-01-01T00:00:00Z",
  };
}

function link(overrides: Record<string, unknown> = {}) {
  return {
    id: 5,
    older_adult_id: 2,
    name: "Anna Lim",
    relationship: "Daughter",
    consent_status: "accepted",
    created_at: "2030-01-01T00:00:00Z",
    older_adult_name: "Mary Lim",
    older_adult_preferred_name: "Mary",
    ...overrides,
  };
}

function renderPortal() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <FamilyPortal />
    </QueryClientProvider>,
  );
}

describe("FamilyPortal", () => {
  afterEach(() => vi.restoreAllMocks());

  it("explains there is no accepted invitation when the viewer is not a trusted contact", () => {
    vi.mocked(useViewerRole).mockReturnValue({
      role: "unknown",
      acceptedLinks: [],
      linksQuery: { refetch: vi.fn() },
      isPending: false,
      isError: false,
    } as never);

    renderPortal();

    expect(screen.getByText(/do not have an accepted family-portal invitation/i)).toBeVisible();
  });

  it("greets by the older adult's preferred name and attributes plans to the trusted contact, not a raw user ID", async () => {
    vi.mocked(useViewerRole).mockReturnValue({
      role: "trusted_contact",
      acceptedLinks: [link()],
      linksQuery: { refetch: vi.fn() },
      isPending: false,
      isError: false,
    } as never);
    vi.spyOn(fetchClient, "GET").mockResolvedValue({
      data: { plans: [plan(1, 2, "awaiting_approval"), plan(2, 2, "shared")] },
      response: new Response(null, { status: 200 }),
    } as never);

    renderPortal();

    expect(await screen.findByRole("heading", { name: /you.re helping mary/i })).toBeVisible();
    expect(await screen.findByText("Plan 1: awaiting_approval (as trusted_contact:5)")).toBeVisible();
    expect(screen.getByText("Plan 2: shared (as trusted_contact:5)")).toBeVisible();
  });

  it("offers a chooser when the contact is linked to more than one older adult", async () => {
    const user = userEvent.setup();
    vi.mocked(useViewerRole).mockReturnValue({
      role: "trusted_contact",
      acceptedLinks: [
        link({ id: 5, older_adult_id: 2, older_adult_name: "Mary Lim", older_adult_preferred_name: "Mary" }),
        link({ id: 6, older_adult_id: 3, older_adult_name: "Ravi Kumar", older_adult_preferred_name: null }),
      ],
      linksQuery: { refetch: vi.fn() },
      isPending: false,
      isError: false,
    } as never);
    vi.spyOn(fetchClient, "GET").mockResolvedValue({
      data: { plans: [] },
      response: new Response(null, { status: 200 }),
    } as never);

    renderPortal();

    expect(await screen.findByRole("heading", { name: /you.re helping mary/i })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Ravi Kumar" }));

    expect(await screen.findByRole("heading", { name: /you.re helping ravi kumar/i })).toBeVisible();
  });
});
