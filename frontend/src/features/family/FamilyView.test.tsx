import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { FamilyView } from "@/features/family/FamilyView";
import { useAuthSession } from "@/features/auth/AuthSessionContext";
import { useSetupProgress } from "@/features/setup/useSetupProgress";
import { fetchClient } from "@/lib/fetchClient";

vi.mock("@tanstack/react-router", () => ({ Link: ({ children }: { children: React.ReactNode }) => <a href="#test">{children}</a> }));
vi.mock("@/features/auth/AuthSessionContext", () => ({ useAuthSession: vi.fn() }));
vi.mock("@/features/setup/useSetupProgress", () => ({ useSetupProgress: vi.fn() }));
vi.mock("@/features/family/FamilyPlanRow", () => ({ FamilyPlanRow: ({ plan }: { plan: { id: number; status: string } }) => <p>Plan {plan.id}: {plan.status}</p> }));

function plan(id: number, status: string) {
  return { id, family_id: 1, older_adult_id: 2, activity_id: id + 20, status, created_by: "user-1", created_at: "2030-01-01T00:00:00Z", updated_at: "2030-01-01T00:00:00Z" };
}

describe("FamilyView", () => {
  beforeEach(() => {
    vi.mocked(useAuthSession).mockReturnValue({ session: { user: { id: "user-1" } } } as never);
    vi.mocked(useSetupProgress).mockReturnValue({ family: { id: 1 }, olderAdult: { name: "Mary Lim", preferred_name: "Mary" }, isPending: false, isError: false } as never);
  });
  afterEach(() => vi.restoreAllMocks());

  it("groups approval, shared, and cancelled plans and labels the demo identity", async () => {
    vi.spyOn(fetchClient, "GET").mockResolvedValue({ data: { plans: [plan(1, "awaiting_approval"), plan(2, "shared"), plan(3, "cancelled")] }, response: new Response(null, { status: 200 }) } as never);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={queryClient}><FamilyView /></QueryClientProvider>);

    expect(await screen.findByText("Plan 1: awaiting_approval")).toBeVisible();
    expect(screen.getByText("Plan 2: shared")).toBeVisible();
    expect(screen.getByText("Plan 3: cancelled")).toBeVisible();
    expect(screen.getByText(/same signed-in demo account/i)).toBeVisible();
    expect(screen.getByRole("heading", { name: /needs your review/i })).toBeVisible();
    expect(screen.getByRole("heading", { name: /shared plans/i })).toBeVisible();
    expect(screen.getByRole("heading", { name: /past plans/i })).toBeVisible();
  });
});
