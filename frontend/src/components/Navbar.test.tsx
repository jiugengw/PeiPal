import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { Navbar } from "@/components/Navbar";
import { useAuthSession } from "@/features/auth/AuthSessionContext";
import { useSetupProgress } from "@/features/setup/useSetupProgress";
import { useViewer } from "@/hooks/useViewer";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));
vi.mock("@/features/auth/AuthSessionContext", () => ({ useAuthSession: vi.fn() }));
vi.mock("@/hooks/useViewer", () => ({ useViewer: vi.fn() }));
vi.mock("@/features/setup/useSetupProgress", () => ({ useSetupProgress: vi.fn() }));
vi.mock("@/features/auth/LogoutButton", () => ({ LogoutButton: () => <button type="button">Log out</button> }));

function viewer(role: "organizer" | "older_adult" | "unknown") {
  return { role, isPending: false, isError: false, query: { refetch: vi.fn() } };
}

function setupProgress(isComplete: boolean) {
  return { isComplete, isPending: false, isError: false };
}

describe("Navbar", () => {
  beforeEach(() => {
    vi.mocked(useViewer).mockReturnValue(viewer("organizer") as never);
    vi.mocked(useSetupProgress).mockReturnValue(setupProgress(false) as never);
    vi.mocked(useAuthSession).mockReturnValue({ session: { user: { id: "user-1" } }, isLoading: false } as never);
  });
  afterEach(() => vi.restoreAllMocks());

  it("only shows Setup for an organizer who hasn't finished setup yet", () => {
    render(<Navbar />);

    expect(screen.getByRole("link", { name: "Setup" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Trusted circle" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Connect an app" })).not.toBeInTheDocument();
  });

  it("shows the trusted circle and connect-an-app tabs once setup is complete", () => {
    vi.mocked(useSetupProgress).mockReturnValue(setupProgress(true) as never);

    render(<Navbar />);

    expect(screen.getByRole("link", { name: "Setup" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Family" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Connect an app" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Explore" })).not.toBeInTheDocument();
  });

  it("shows the older adult their own three tabs, and never setup, regardless of setup progress", () => {
    vi.mocked(useViewer).mockReturnValue(viewer("older_adult") as never);

    render(<Navbar />);

    expect(screen.getByRole("link", { name: "Explore" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Plans" })).toBeVisible();
    expect(screen.getByRole("link", { name: "My support circle" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Setup" })).not.toBeInTheDocument();
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
