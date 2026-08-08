import { queryOptions } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProviders } from "@/app/providers/AppProviders";
import { ConnectApps } from "@/features/workbuddy/ConnectApps";
import {
  createWorkBuddyToken,
  revokeWorkBuddyToken,
  workbuddyTokensQueryKey,
  workbuddyTokensQueryOptions,
  type WorkBuddyToken,
} from "@/features/workbuddy/api/workbuddyTokenQueries";

vi.mock("@/features/workbuddy/api/workbuddyTokenQueries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/workbuddy/api/workbuddyTokenQueries")>();
  return {
    ...actual,
    createWorkBuddyToken: vi.fn(),
    revokeWorkBuddyToken: vi.fn(),
    workbuddyTokensQueryOptions: vi.fn(),
  };
});

const createMock = vi.mocked(createWorkBuddyToken);
const revokeMock = vi.mocked(revokeWorkBuddyToken);
const queryOptionsMock = vi.mocked(workbuddyTokensQueryOptions);

function mockTokens(tokens: WorkBuddyToken[]) {
  queryOptionsMock.mockReturnValue(
    queryOptions({
      queryKey: workbuddyTokensQueryKey,
      queryFn: async () => tokens,
    }),
  );
}

function renderPage() {
  return render(
    <AppProviders>
      <ConnectApps />
    </AppProviders>,
  );
}

describe("ConnectApps", () => {
  beforeEach(() => {
    createMock.mockReset();
    revokeMock.mockReset();
    queryOptionsMock.mockReset();
  });

  it("shows no apps connected yet when the list is empty", async () => {
    mockTokens([]);
    renderPage();
    expect(await screen.findByText(/no apps connected yet/i)).toBeVisible();
  });

  it("lists existing tokens without ever showing the raw value", async () => {
    mockTokens([
      { id: 1, name: "WorkBuddy", created_at: "2026-01-01T00:00:00Z", revoked_at: null },
    ]);
    renderPage();
    expect(await screen.findByText("WorkBuddy")).toBeVisible();
    expect(screen.getByRole("button", { name: /revoke/i })).toBeVisible();
  });

  it("generates a new token and shows it exactly once", async () => {
    mockTokens([]);
    createMock.mockResolvedValue({
      id: 2,
      name: "ChatGPT",
      token: "raw-token-value",
      created_at: "2026-01-01T00:00:00Z",
    });
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/name this app/i), "ChatGPT");
    await user.click(screen.getByRole("button", { name: /generate token/i }));

    expect(createMock).toHaveBeenCalledWith("ChatGPT");
    expect(await screen.findByText("raw-token-value")).toBeVisible();
    expect(screen.getByText(/copy this now/i)).toBeVisible();
  });

  it("revokes a token", async () => {
    mockTokens([
      { id: 1, name: "WorkBuddy", created_at: "2026-01-01T00:00:00Z", revoked_at: null },
    ]);
    revokeMock.mockResolvedValue();
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: /revoke/i }));

    expect(revokeMock).toHaveBeenCalledWith(1);
  });
});
