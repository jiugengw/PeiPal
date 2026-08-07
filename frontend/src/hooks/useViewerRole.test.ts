import { renderHook } from "@testing-library/react";
import { useQuery } from "@tanstack/react-query";
import { useViewerRole } from "@/hooks/useViewerRole";
import { useSetupProgress } from "@/features/setup/useSetupProgress";
import { TRUSTED_CONTACT_CONSENT_ACCEPTED } from "@/features/family/api/trustedContactQueries";

vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQuery: vi.fn(),
}));
vi.mock("@/features/setup/useSetupProgress", () => ({ useSetupProgress: vi.fn() }));

const mockedUseQuery = vi.mocked(useQuery);
const mockedSetupProgress = vi.mocked(useSetupProgress);

function setup(overrides: Record<string, unknown> = {}) {
  return {
    household: undefined,
    olderAdult: undefined,
    contacts: [],
    isPending: false,
    isError: false,
    isComplete: false,
    householdsQuery: { refetch: vi.fn() },
    olderAdultsQuery: { refetch: vi.fn() },
    trustedContactsQuery: { refetch: vi.fn() },
    ...overrides,
  };
}

function linksResult(data?: unknown, overrides: Record<string, unknown> = {}) {
  return { data, isPending: false, isError: false, refetch: vi.fn(), ...overrides };
}

describe("useViewerRole", () => {
  beforeEach(() => {
    mockedUseQuery.mockReset();
    mockedSetupProgress.mockReset();
  });

  it("reports household role, and never enables the trusted-contact check", () => {
    mockedSetupProgress.mockReturnValue(setup({ household: { id: 1 } }) as never);
    mockedUseQuery.mockReturnValue(linksResult(undefined) as never);

    const { result } = renderHook(() => useViewerRole());

    expect(mockedUseQuery.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ enabled: false }));
    expect(result.current.role).toBe("household");
  });

  it("reports trusted_contact role when there is no household but an accepted link exists", () => {
    mockedSetupProgress.mockReturnValue(setup() as never);
    mockedUseQuery.mockReturnValue(
      linksResult({ trusted_contacts: [{ id: 5, consent_status: TRUSTED_CONTACT_CONSENT_ACCEPTED }] }) as never,
    );

    const { result } = renderHook(() => useViewerRole());

    expect(mockedUseQuery.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ enabled: true }));
    expect(result.current.role).toBe("trusted_contact");
    expect(result.current.acceptedLinks).toHaveLength(1);
  });

  it("reports unknown role when there is no household and no accepted link", () => {
    mockedSetupProgress.mockReturnValue(setup() as never);
    mockedUseQuery.mockReturnValue(
      linksResult({ trusted_contacts: [{ id: 5, consent_status: "pending" }] }) as never,
    );

    const { result } = renderHook(() => useViewerRole());

    expect(result.current.role).toBe("unknown");
    expect(result.current.acceptedLinks).toHaveLength(0);
  });

  it("stays pending while setup itself is pending, without resolving a role", () => {
    mockedSetupProgress.mockReturnValue(setup({ isPending: true }) as never);
    mockedUseQuery.mockReturnValue(linksResult(undefined) as never);

    const { result } = renderHook(() => useViewerRole());

    expect(result.current.isPending).toBe(true);
    expect(result.current.role).toBe("unknown");
  });
});
