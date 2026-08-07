import { renderHook } from "@testing-library/react";
import { useQuery } from "@tanstack/react-query";
import { useSetupProgress } from "@/features/setup/useSetupProgress";

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(),
}));

const mockedUseQuery = vi.mocked(useQuery);

function queryResult(data?: unknown, overrides: Record<string, unknown> = {}) {
  return {
    data,
    isPending: false,
    isError: false,
    refetch: vi.fn(),
    ...overrides,
  };
}

describe("useSetupProgress", () => {
  beforeEach(() => mockedUseQuery.mockReset());

  it("enables dependent setup queries only when their parent record exists", () => {
    mockedUseQuery
      .mockReturnValueOnce(queryResult({ families: [] }) as never)
      .mockReturnValueOnce(queryResult(undefined) as never)
      .mockReturnValueOnce(queryResult(undefined) as never);

    const { result } = renderHook(() => useSetupProgress());

    expect(mockedUseQuery.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({ enabled: false }),
    );
    expect(mockedUseQuery.mock.calls[2]?.[0]).toEqual(
      expect.objectContaining({ enabled: false }),
    );
    expect(result.current.isComplete).toBe(false);
  });

  it("loads older adults and contacts sequentially and reports completion", () => {
    const family = { id: 1, name: "Lim Family" };
    const olderAdult = { id: 2, family_id: 1, name: "Mary Lim" };
    const contact = { id: 3, older_adult_id: 2, name: "Anna" };
    mockedUseQuery
      .mockReturnValueOnce(queryResult({ families: [family] }) as never)
      .mockReturnValueOnce(queryResult({ older_adults: [olderAdult] }) as never)
      .mockReturnValueOnce(
        queryResult({ family_members: [contact] }) as never,
      );

    const { result } = renderHook(() => useSetupProgress());

    expect(mockedUseQuery.mock.calls[1]?.[0]).toEqual(
      expect.objectContaining({ enabled: true }),
    );
    expect(mockedUseQuery.mock.calls[2]?.[0]).toEqual(
      expect.objectContaining({ enabled: true }),
    );
    expect(result.current).toEqual(
      expect.objectContaining({
        family,
        olderAdult,
        familyMembers: [contact],
        isComplete: true,
        isPending: false,
        isError: false,
      }),
    );
  });

  it("combines pending and error states from the active setup queries", () => {
    mockedUseQuery
      .mockReturnValueOnce(queryResult({ families: [{ id: 1 }] }) as never)
      .mockReturnValueOnce(queryResult(undefined, { isPending: true }) as never)
      .mockReturnValueOnce(queryResult(undefined, { isError: true }) as never);

    const { result } = renderHook(() => useSetupProgress());

    expect(result.current.isPending).toBe(true);
    expect(result.current.isError).toBe(true);
    expect(result.current.isComplete).toBe(false);
  });
});
