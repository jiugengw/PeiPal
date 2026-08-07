import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { Navbar } from "@/components/Navbar";
import { useAuthSession } from "@/features/auth/AuthSessionContext";
import { useViewerRole } from "@/hooks/useViewerRole";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));
vi.mock("@/features/auth/AuthSessionContext", () => ({ useAuthSession: vi.fn() }));
vi.mock("@/hooks/useViewerRole", () => ({ useViewerRole: vi.fn() }));
vi.mock("@/features/auth/LogoutButton", () => ({ LogoutButton: () => <button type="button">Log out</button> }));

function role(value: "household" | "trusted_contact" | "unknown") {
  return { role: value, setup: {}, acceptedLinks: [], linksQuery: { refetch: vi.fn() }, isPending: false, isError: false };
}

describe("Navbar", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows Discover and Setup, but never Family view, for a household member", () => {
    vi.mocked(useAuthSession).mockReturnValue({ session: { user: { id: "user-1" } }, isLoading: false } as never);
    vi.mocked(useViewerRole).mockReturnValue(role("household") as never);

    render(<Navbar />);

    expect(screen.getByRole("link", { name: "Discover" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Setup" })).toBeVisible();
    expect(screen.queryByRole("link", { name: /family view/i })).not.toBeInTheDocument();
  });

  it("shows only the family portal link for a trusted contact", () => {
    vi.mocked(useAuthSession).mockReturnValue({ session: { user: { id: "user-1" } }, isLoading: false } as never);
    vi.mocked(useViewerRole).mockReturnValue(role("trusted_contact") as never);

    render(<Navbar />);

    expect(screen.getByRole("link", { name: "Family portal" })).toBeVisible();
    expect(screen.queryByRole("link", { name: "Discover" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Setup" })).not.toBeInTheDocument();
  });

  it("shows a log-in link when signed out", () => {
    vi.mocked(useAuthSession).mockReturnValue({ session: null, isLoading: false } as never);
    vi.mocked(useViewerRole).mockReturnValue(role("unknown") as never);

    render(<Navbar />);

    expect(screen.getByRole("link", { name: /log in/i })).toBeVisible();
    expect(screen.queryByRole("button", { name: /log out/i })).not.toBeInTheDocument();
  });
});
