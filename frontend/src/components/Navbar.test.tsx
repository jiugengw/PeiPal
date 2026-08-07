import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { Navbar } from "@/components/Navbar";
import { useAuthSession } from "@/features/auth/AuthSessionContext";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}));
vi.mock("@/features/auth/AuthSessionContext", () => ({ useAuthSession: vi.fn() }));
vi.mock("@/features/auth/LogoutButton", () => ({ LogoutButton: () => <button type="button">Log out</button> }));

describe("Navbar", () => {
  afterEach(() => vi.restoreAllMocks());

  it("shows the family navigation to a signed-in account", () => {
    vi.mocked(useAuthSession).mockReturnValue({ session: { user: { id: "user-1" } }, isLoading: false } as never);

    render(<Navbar />);

    expect(screen.getByRole("link", { name: "Discover" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Setup" })).toBeVisible();
    expect(screen.getByRole("link", { name: /family view/i })).toBeVisible();
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
