import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { Navbar } from "@/components/Navbar";
import { useAuthSession } from "@/features/auth/AuthSessionContext";
import { useViewer } from "@/hooks/useViewer";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));
vi.mock("@/features/auth/AuthSessionContext", () => ({ useAuthSession: vi.fn() }));
vi.mock("@/hooks/useViewer", () => ({ useViewer: vi.fn() }));
vi.mock("@/features/auth/LogoutButton", () => ({ LogoutButton: () => <button type="button">Log out</button> }));

function viewer(role: "organizer" | "older_adult" | "unknown") {
  return { role, isPending: false, isError: false, query: { refetch: vi.fn() } };
}

describe("Navbar", () => {
  beforeEach(() => {
    vi.mocked(useViewer).mockReturnValue(viewer("organizer") as never);
    vi.mocked(useAuthSession).mockReturnValue({ session: { user: { id: "user-1" } }, isLoading: false } as never);
  });
  afterEach(() => vi.restoreAllMocks());

  it("shows the logo and logout button for an organizer", () => {
    render(<Navbar />);

    expect(screen.getByRole("link", { name: "PeiPal" })).toBeVisible();
    expect(screen.getByRole("button", { name: /log out/i })).toBeVisible();
  });

  it("shows nothing in the nav slot for an organizer - no page title, no links", () => {
    render(<Navbar />);

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.queryByText("Setup")).not.toBeInTheDocument();
    expect(screen.queryByText("Family")).not.toBeInTheDocument();
  });

  it("shows nothing extra for an unresolved (unknown-role) account either", () => {
    vi.mocked(useViewer).mockReturnValue(viewer("unknown") as never);

    render(<Navbar />);

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("still gives the older adult real clickable tabs, unaffected by the organizer change", () => {
    vi.mocked(useViewer).mockReturnValue(viewer("older_adult") as never);

    render(<Navbar />);

    expect(screen.getByRole("navigation", { name: /primary navigation/i })).toBeVisible();
    expect(screen.getByRole("link", { name: "Explore" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Plans" })).toBeVisible();
    expect(screen.getByRole("link", { name: "My family" })).toBeVisible();
  });

  it("offers a log in link instead of logging out when signed out", () => {
    vi.mocked(useAuthSession).mockReturnValue({ session: null, isLoading: false } as never);

    render(<Navbar />);

    expect(screen.getByRole("link", { name: /log in/i })).toBeVisible();
    expect(screen.queryByRole("button", { name: /log out/i })).not.toBeInTheDocument();
  });

  it("shows a placeholder while the session is loading", () => {
    vi.mocked(useAuthSession).mockReturnValue({ session: null, isLoading: true } as never);

    render(<Navbar />);

    expect(screen.queryByRole("link", { name: /log in/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /log out/i })).not.toBeInTheDocument();
  });
});
