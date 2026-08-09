import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FamilyPeople } from "@/features/family/FamilyPeople";
import { useViewer } from "@/hooks/useViewer";
import { fetchClient } from "@/lib/fetchClient";
import { createQueryClient } from "@/lib/queryClient";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));
vi.mock("@/hooks/useViewer", () => ({ useViewer: vi.fn() }));

function viewer(overrides: Record<string, unknown> = {}) {
  return {
    role: "organizer",
    familyId: 1,
    olderAdultId: undefined,
    isPending: false,
    isError: false,
    ...overrides,
  };
}

function renderPage() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <FamilyPeople />
    </QueryClientProvider>,
  );
}

describe("FamilyPeople", () => {
  afterEach(() => vi.restoreAllMocks());

  it("keeps the organizer's instructions collapsed until opened", async () => {
    const user = userEvent.setup();
    vi.mocked(useViewer).mockReturnValue(viewer() as never);
    vi.spyOn(fetchClient, "GET").mockImplementation((async (path: string) => {
      if (path === "/api/families/{family_id}/members") {
        return { data: { family_members: [] }, response: new Response(null, { status: 200 }) };
      }
      return {
        data: { older_adults: [{ id: 2, family_id: 1, name: "Mary Lim", preferred_name: "Mary" }] },
        response: new Response(null, { status: 200 }),
      };
    }) as never);

    renderPage();

    const summary = await screen.findByText(/what happens next/i);
    expect(summary).toBeVisible();
    expect(screen.queryByText(/opens the sign-in link/i)).not.toBeVisible();

    await user.click(summary);

    expect(await screen.findByText(/mary opens the sign-in link/i)).toBeVisible();
  });

  it("does not show the instructions tab to the older adult", async () => {
    vi.mocked(useViewer).mockReturnValue(viewer({ role: "older_adult", olderAdultId: 2 }) as never);
    vi.spyOn(fetchClient, "GET").mockResolvedValue({
      data: { family_members: [] },
      response: new Response(null, { status: 200 }),
    } as never);

    renderPage();

    await screen.findByRole("heading", { name: /your support circle/i });
    expect(screen.queryByText(/what happens next/i)).not.toBeInTheDocument();
  });
});
