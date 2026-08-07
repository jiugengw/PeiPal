import type { Session } from "@supabase/supabase-js";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  RouterProvider,
  createMemoryHistory,
  createRouter,
} from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import { routeTree } from "@/routeTree.gen";
import { AuthSessionContext } from "@/features/auth/AuthSessionContext";
import { createQueryClient } from "@/lib/queryClient";

const { useSetupProgress } = vi.hoisted(() => ({ useSetupProgress: vi.fn() }));
const { useViewerRole } = vi.hoisted(() => ({ useViewerRole: vi.fn() }));

vi.mock("@/features/setup/useSetupProgress", () => ({ useSetupProgress }));
vi.mock("@/hooks/useViewerRole", () => ({ useViewerRole }));

function setupProgress(complete = false) {
  return {
    household: complete ? { id: 1, name: "Lim Family" } : undefined,
    olderAdult: complete ? { id: 2, household_id: 1, name: "Mary" } : undefined,
    contacts: complete ? [{ id: 3, name: "Anna" }] : [],
    isPending: false,
    isError: false,
    isComplete: complete,
    householdsQuery: { refetch: vi.fn() },
    olderAdultsQuery: { refetch: vi.fn() },
    trustedContactsQuery: { refetch: vi.fn() },
  };
}

function viewerRole(
  role: "household" | "trusted_contact" | "unknown",
  setup: ReturnType<typeof setupProgress>,
  acceptedLinks: Array<Record<string, unknown>> = [],
) {
  return {
    role,
    setup,
    acceptedLinks,
    linksQuery: { refetch: vi.fn() },
    isPending: false,
    isError: false,
  };
}

function renderRoute(path: string, authenticated = false) {
  const auth = {
    session: authenticated ? ({} as Session) : null,
    isLoading: false,
  };
  const testRouter = createRouter({
    routeTree,
    context: { auth },
    history: createMemoryHistory({ initialEntries: [path] }),
  });

  const view = render(
    <QueryClientProvider client={createQueryClient()}>
      <AuthSessionContext.Provider value={auth}>
        <RouterProvider router={testRouter} context={{ auth }} />
      </AuthSessionContext.Provider>
    </QueryClientProvider>,
  );
  return { router: testRouter, view };
}

describe("application routes", () => {
  beforeEach(() => {
    useSetupProgress.mockReturnValue(setupProgress());
    useViewerRole.mockReturnValue(viewerRole("unknown", setupProgress()));
  });

  it("redirects an incomplete account to setup", async () => {
    const { router } = renderRoute("/", true);
    await waitFor(() => expect(router.state.location.pathname).toBe("/setup"));
    expect(
      await screen.findByRole("heading", {
        name: /who are we setting this up for/i,
      }),
    ).toBeVisible();
  });

  it("redirects a complete account to discovery", async () => {
    const complete = setupProgress(true);
    useSetupProgress.mockReturnValue(complete);
    useViewerRole.mockReturnValue(viewerRole("household", complete));
    const { router } = renderRoute("/", true);
    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/discover"),
    );
  });

  it("redirects a trusted contact to their family portal", async () => {
    useViewerRole.mockReturnValue(
      viewerRole("trusted_contact", setupProgress(), [
        {
          id: 5,
          older_adult_id: 2,
          name: "Anna Lim",
          relationship: "Daughter",
          consent_status: "accepted",
          created_at: "2030-01-01T00:00:00Z",
          older_adult_name: "Mary Lim",
          older_adult_preferred_name: "Mary",
        },
      ]),
    );
    const { router } = renderRoute("/", true);
    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/family-portal"),
    );
  });

  it("renders a helpful not-found page for an authenticated user", async () => {
    renderRoute("/missing", true);
    expect(
      await screen.findByRole("heading", {
        name: /we could not find that page/i,
      }),
    ).toBeVisible();
  });

  it("renders authentication outside the main app shell", async () => {
    renderRoute("/auth");
    expect(
      await screen.findByRole("heading", { name: /welcome back/i }),
    ).toBeVisible();
    expect(
      screen.queryByRole("navigation", { name: /primary navigation/i }),
    ).not.toBeInTheDocument();
  });

  it("redirects signed-out visitors away from protected pages", async () => {
    renderRoute("/family");
    expect(
      await screen.findByRole("heading", { name: /welcome back/i }),
    ).toBeVisible();
    expect(
      screen.queryByRole("navigation", { name: /primary navigation/i }),
    ).not.toBeInTheDocument();
  });
});
