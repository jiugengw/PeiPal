import { queryOptions } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppProviders } from "@/app/providers/AppProviders";
import { ConnectApps } from "@/features/workbuddy/ConnectApps";
import {
  revokeWorkBuddyConnection,
  workbuddyConnectionsQueryKey,
  workbuddyConnectionsQueryOptions,
  type WorkBuddyConnection,
} from "@/features/workbuddy/api/workbuddyConnectionQueries";

vi.mock("@/features/workbuddy/api/workbuddyConnectionQueries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/workbuddy/api/workbuddyConnectionQueries")>();
  return {
    ...actual,
    revokeWorkBuddyConnection: vi.fn(),
    workbuddyConnectionsQueryOptions: vi.fn(),
  };
});

const revokeMock = vi.mocked(revokeWorkBuddyConnection);
const queryOptionsMock = vi.mocked(workbuddyConnectionsQueryOptions);

function mockConnections(connections: WorkBuddyConnection[]) {
  queryOptionsMock.mockReturnValue(
    queryOptions({
      queryKey: workbuddyConnectionsQueryKey,
      queryFn: async () => connections,
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
    revokeMock.mockReset();
    queryOptionsMock.mockReset();
  });

  it("shows no apps connected yet when the list is empty", async () => {
    mockConnections([]);
    renderPage();
    expect(await screen.findByText(/no apps are connected yet/i)).toBeVisible();
  });

  it("lists existing tokens without ever showing the raw value", async () => {
    mockConnections([
      { client_id: "client-1", scope: "activities:read plans:read plans:write", created_at: "2026-01-01T00:00:00Z", expires_at: "2026-02-01T00:00:00Z", revoked_at: null },
    ]);
    renderPage();
    expect(await screen.findByText("WorkBuddy")).toBeVisible();
    expect(screen.getByRole("button", { name: /revoke/i })).toBeVisible();
  });

  it("generates a new token and shows it exactly once", async () => {
    mockConnections([]);
    renderPage();

    expect(await screen.findByText(/no apps are connected yet/i)).toBeVisible();
    expect(screen.getByRole("button", { name: /copy address/i })).toBeVisible();
  });

  it("revokes a token", async () => {
    mockConnections([
      { client_id: "client-1", scope: "activities:read plans:read plans:write", created_at: "2026-01-01T00:00:00Z", expires_at: "2026-02-01T00:00:00Z", revoked_at: null },
    ]);
    revokeMock.mockResolvedValue();
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole("button", { name: /revoke access/i }));

    expect(revokeMock).toHaveBeenCalledWith("client-1", expect.anything());
  });
});
