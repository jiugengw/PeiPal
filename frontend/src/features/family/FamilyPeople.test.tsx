import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
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
    role: "older_adult",
    familyId: 1,
    olderAdultId: 2,
    isPending: false,
    isError: false,
    ...overrides,
  };
}

function renderPage(queryClient = createQueryClient()) {
  return render(
    <QueryClientProvider client={queryClient}>
      <FamilyPeople />
    </QueryClientProvider>,
  );
}

describe("FamilyPeople", () => {
  afterEach(() => vi.restoreAllMocks());

  it("lists the older adult's family, with their own relationship shown first", async () => {
    vi.mocked(useViewer).mockReturnValue(viewer() as never);
    vi.spyOn(fetchClient, "GET").mockResolvedValue({
      data: {
        family_members: [
          {
            id: 3,
            name: "Anna",
            relationships: [{ older_adult_id: 2, relationship: "Daughter" }],
          },
        ],
      },
      response: new Response(null, { status: 200 }),
    } as never);

    renderPage();

    expect(await screen.findByRole("heading", { name: "Your family" })).toBeVisible();
    expect(await screen.findByText("Anna")).toBeVisible();
    expect(screen.getByText("Daughter")).toBeVisible();
  });

  it("shows an empty state when nobody has been added yet", async () => {
    vi.mocked(useViewer).mockReturnValue(viewer() as never);
    vi.spyOn(fetchClient, "GET").mockResolvedValue({
      data: { family_members: [] },
      response: new Response(null, { status: 200 }),
    } as never);

    renderPage();

    expect(
      await screen.findByText(/nobody has been added yet/i),
    ).toBeVisible();
  });

  it("shows a loading status while the viewer or members are still resolving", () => {
    vi.mocked(useViewer).mockReturnValue(viewer({ isPending: true }) as never);

    renderPage();

    expect(screen.getByRole("status")).toHaveTextContent(/loading your family/i);
  });

  it("shows an error state if the viewer or members fail to load", async () => {
    vi.mocked(useViewer).mockReturnValue(viewer({ isError: true }) as never);
    vi.spyOn(fetchClient, "GET").mockResolvedValue({
      data: undefined,
      error: { detail: "Server error" },
      response: new Response(null, { status: 500 }),
    } as never);

    const queryClient = createQueryClient();
    queryClient.setDefaultOptions({ queries: { retry: false } });
    renderPage(queryClient);

    expect(
      await screen.findByText(/we could not load your family/i),
    ).toBeVisible();
  });
});
