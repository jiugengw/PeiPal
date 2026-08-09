import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { OrganizerFamilies } from "@/features/family/OrganizerFamilies";
import { fetchClient } from "@/lib/fetchClient";
import { createQueryClient } from "@/lib/queryClient";

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to,
    search,
    className,
  }: {
    children: ReactNode;
    to: string;
    search?: Record<string, unknown>;
    className?: string;
  }) => {
    const query = search
      ? `?${new URLSearchParams(search as Record<string, string>).toString()}`
      : "";
    return (
      <a className={className} href={`${to}${query}`}>
        {children}
      </a>
    );
  },
}));

function renderPage(queryClient = createQueryClient()) {
  return render(
    <QueryClientProvider client={queryClient}>
      <OrganizerFamilies />
    </QueryClientProvider>,
  );
}

describe("OrganizerFamilies", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows an empty state and an Add family action when there are none yet", async () => {
    vi.spyOn(fetchClient, "GET").mockResolvedValueOnce({
      data: { families: [] },
      response: new Response(null, { status: 200 }),
    } as never);

    renderPage();

    expect(
      await screen.findByText(/haven.t added a family yet/i),
    ).toBeVisible();
    const addLink = screen.getByRole("link", { name: /add family/i });
    expect(addLink).toHaveAttribute("href", "/setup");
  });

  it("lists existing families, each linking to setup scoped to that family", async () => {
    vi.spyOn(fetchClient, "GET").mockResolvedValueOnce({
      data: {
        families: [
          { id: 1, name: "Lim Family", created_by: "user-1", created_at: "2030-01-01T00:00:00Z" },
          { id: 2, name: "Tan Family", created_by: "user-1", created_at: "2030-02-01T00:00:00Z" },
        ],
      },
      response: new Response(null, { status: 200 }),
    } as never);

    renderPage();

    expect(await screen.findByText("Lim Family")).toBeVisible();
    expect(screen.getByText("Tan Family")).toBeVisible();

    const limLink = screen.getByText("Lim Family").closest("a");
    expect(limLink).toHaveAttribute("href", "/setup?familyId=1");
    const tanLink = screen.getByText("Tan Family").closest("a");
    expect(tanLink).toHaveAttribute("href", "/setup?familyId=2");

    // Adding another family is always available, not just in the empty state.
    expect(screen.getByRole("link", { name: /add family/i })).toHaveAttribute(
      "href",
      "/setup",
    );
  });

  it("offers a retry action when families fail to load", async () => {
    vi.spyOn(fetchClient, "GET").mockResolvedValueOnce({
      data: undefined,
      error: { detail: "Server error" },
      response: new Response(null, { status: 500 }),
    } as never);

    const queryClient = createQueryClient();
    queryClient.setDefaultOptions({ queries: { retry: false } });
    renderPage(queryClient);

    expect(
      await screen.findByText(/could not load your families/i),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: /try again/i })).toBeVisible();
  });
});
