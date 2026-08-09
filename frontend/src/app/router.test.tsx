import type { Session } from "@supabase/supabase-js";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  RouterProvider,
  createMemoryHistory,
  createRouter,
} from "@tanstack/react-router";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { routeTree } from "@/routeTree.gen";
import { AuthSessionContext } from "@/features/auth/AuthSessionContext";
import { createQueryClient } from "@/lib/queryClient";

const { useSetupProgress } = vi.hoisted(() => ({ useSetupProgress: vi.fn() }));
const { useViewer } = vi.hoisted(() => ({ useViewer: vi.fn() }));

vi.mock("@/features/setup/useSetupProgress", () => ({ useSetupProgress }));
vi.mock("@/hooks/useViewer", () => ({ useViewer }));

function setupProgress(complete = false) {
  return {
    family: complete ? { id: 1, name: "Lim Family" } : undefined,
    olderAdult: complete ? { id: 2, family_id: 1, name: "Mary" } : undefined,
    olderAdults: complete ? [{ id: 2, family_id: 1, name: "Mary" }] : [],
    familyMembers: complete ? [{ id: 3, name: "Anna" }] : [],
    isPending: false,
    isError: false,
    isComplete: complete,
    familiesQuery: { refetch: vi.fn() },
    olderAdultsQuery: { refetch: vi.fn() },
    familyMembersQuery: { refetch: vi.fn() },
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

function viewer(role: "organizer" | "older_adult" | "unknown" = "organizer") {
  return {
    role,
    olderAdultId: role === "older_adult" ? 2 : undefined,
    familyId: 1,
    displayName: undefined,
    isPending: false,
    isError: false,
    query: { refetch: vi.fn() },
  };
}

describe("application routes", () => {
  beforeEach(() => {
    useSetupProgress.mockReturnValue(setupProgress());
    useViewer.mockReturnValue(viewer());
  });

  it("sends the organizer to their families", async () => {
    const { router } = renderRoute("/", true);
    await waitFor(() => expect(router.state.location.pathname).toBe("/family"));
  });

  it("keeps the organizer out of the older adult's pages", async () => {
    const { router } = renderRoute("/discover", true);
    await waitFor(() => expect(router.state.location.pathname).toBe("/family"));
  });

  it("lets the organizer reach the family page directly", async () => {
    const { router } = renderRoute("/family", true);
    await waitFor(() => expect(router.state.location.pathname).toBe("/family"));
  });

  it("also lets the organizer reach setup directly, to add or edit a family", async () => {
    const { router } = renderRoute("/setup", true);
    await waitFor(() => expect(router.state.location.pathname).toBe("/setup"));
  });

  it("sends an unresolved account to /family too, same as a resolved organizer", async () => {
    useViewer.mockReturnValue(viewer("unknown"));
    const { router } = renderRoute("/discover", true);
    await waitFor(() => expect(router.state.location.pathname).toBe("/family"));
  });

  it("keeps the older adult out of setup", async () => {
    useViewer.mockReturnValue(viewer("older_adult"));
    const { router } = renderRoute("/setup", true);
    await waitFor(() => expect(router.state.location.pathname).toBe("/discover"));
  });

  it("sends an older adult straight to discovery, never to setup", async () => {
    useViewer.mockReturnValue(viewer("older_adult"));
    useSetupProgress.mockReturnValue(setupProgress());
    const { router } = renderRoute("/", true);
    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/discover"),
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
      await screen.findByRole("heading", { name: /sign in to peipal/i }),
    ).toBeVisible();
    expect(document.querySelector('img[aria-hidden="true"]')).toBeInTheDocument();
    expect(
      screen.queryByRole("navigation", { name: /primary navigation/i }),
    ).not.toBeInTheDocument();
  });

  it("shows only email-code authentication to an older adult", async () => {
    renderRoute("/auth");

    expect(
      await screen.findByRole("heading", {
        name: /sign in to peipal/i,
      }),
    ).toBeVisible();
    expect(screen.getByText(/we’ll email you a six-digit code/i)).toBeVisible();
    expect(screen.getByRole("button", { name: /email me a code/i })).toBeVisible();
    expect(screen.queryByLabelText(/^password$/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/full name/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /create account/i }),
    ).not.toBeInTheDocument();
  });

  it("takes password users to creator authentication and preserves redirect", async () => {
    const user = userEvent.setup();
    const { router } = renderRoute("/auth?redirect=%2Ffamily");

    await user.click(
      await screen.findByRole("link", { name: /guardian sign in/i }),
    );

    await waitFor(() =>
      expect(router.state.location.pathname).toBe("/auth/creator"),
    );
    expect(router.state.location.search).toMatchObject({ redirect: "/family" });
    expect(
      await screen.findByRole("heading", { name: /welcome back/i }),
    ).toBeVisible();
    expect(screen.getByLabelText(/^password$/i)).toBeVisible();
    expect(
      screen.queryByRole("heading", {
        name: /sign in to peipal/i,
      }),
    ).not.toBeInTheDocument();
  });

  it("lets creator users return to email-code authentication", async () => {
    const user = userEvent.setup();
    const { router } = renderRoute("/auth/creator?redirect=%2Ffamily");

    await user.click(
      await screen.findByRole("link", { name: /sign in as a senior instead/i }),
    );

    await waitFor(() => expect(router.state.location.pathname).toBe("/auth"));
    expect(router.state.location.search).toMatchObject({ redirect: "/family" });
    expect(
      await screen.findByRole("heading", {
        name: /sign in to peipal/i,
      }),
    ).toBeVisible();
  });

  it("redirects signed-out visitors away from protected pages", async () => {
    renderRoute("/family");
    expect(
      await screen.findByRole("heading", { name: /sign in to peipal/i }),
    ).toBeVisible();
    expect(
      screen.queryByRole("navigation", { name: /primary navigation/i }),
    ).not.toBeInTheDocument();
  });
});
