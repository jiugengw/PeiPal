import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SetupWizard } from "@/features/setup/SetupWizard";
import { useSetupProgress } from "@/features/setup/useSetupProgress";
import { fetchClient } from "@/lib/fetchClient";
import { createQueryClient } from "@/lib/queryClient";

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  useNavigate: () => navigate,
}));

vi.mock("@/features/setup/useSetupProgress", () => ({
  useSetupProgress: vi.fn(),
}));

const mockedProgress = vi.mocked(useSetupProgress);

const OLDER_ADULT = {
  id: 2,
  family_id: 1,
  name: "Mary Lim",
  preferred_name: "Mary",
};

function familyMember(overrides: Record<string, unknown> = {}) {
  return {
    id: 3,
    family_id: 1,
    name: "Anna",
    email: "anna@example.com",
    relationships: [{ older_adult_id: 2, relationship: "Daughter" }],
    created_at: "2030-01-01T00:00:00Z",
    ...overrides,
  };
}

function progress(overrides: Record<string, unknown> = {}) {
  return {
    family: undefined,
    olderAdult: undefined,
    olderAdults: [],
    familyMembers: [],
    isPending: false,
    isError: false,
    isComplete: false,
    familiesQuery: { refetch: vi.fn() },
    olderAdultsQuery: { refetch: vi.fn() },
    familyMembersQuery: { refetch: vi.fn() },
    ...overrides,
  };
}

function renderWizard() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <SetupWizard />
    </QueryClientProvider>,
  );
}

describe("SetupWizard", () => {
  beforeEach(() => {
    navigate.mockReset();
    mockedProgress.mockReset();
    mockedProgress.mockReturnValue(progress() as never);
  });

  afterEach(() => vi.restoreAllMocks());

  it("shows saved-setup loading and retries a failed load", async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    mockedProgress.mockReturnValueOnce(progress({ isPending: true }) as never);
    const view = renderWizard();

    expect(screen.getByRole("status")).toHaveTextContent(
      /loading your saved setup/i,
    );

    mockedProgress.mockReturnValue(
      progress({
        isError: true,
        familiesQuery: { refetch },
      }) as never,
    );
    view.rerender(
      <QueryClientProvider client={createQueryClient()}>
        <SetupWizard />
      </QueryClientProvider>,
    );
    await user.click(screen.getByRole("button", { name: /try again/i }));

    expect(refetch).toHaveBeenCalledOnce();
  });

  it("does not submit an empty family name", async () => {
    const user = userEvent.setup();
    const post = vi.spyOn(fetchClient, "POST");
    renderWizard();

    await user.click(screen.getByRole("button", { name: /create family/i }));

    expect(post).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/family name/i)).toBeInvalid();
  });

  it("creates a family and advances to profile details", async () => {
    const user = userEvent.setup();
    vi.spyOn(fetchClient, "POST").mockResolvedValueOnce({
      data: {
        id: 1,
        name: "Lim Family",
        created_by: "user-1",
        created_at: "2030-01-01T00:00:00Z",
      },
      response: new Response(null, { status: 201 }),
    });
    renderWizard();

    await user.type(screen.getByLabelText(/family name/i), "Lim Family");
    await user.click(screen.getByRole("button", { name: /create family/i }));

    expect(fetchClient.POST).toHaveBeenCalledWith("/api/families", {
      body: { name: "Lim Family" },
    });
    expect(
      await screen.findByRole("heading", { name: /what makes support comfortable/i }),
    ).toBeVisible();
  });

  it("keeps the family draft after a failed save and succeeds on retry", async () => {
    const user = userEvent.setup();
    const post = vi
      .spyOn(fetchClient, "POST")
      .mockResolvedValueOnce({
        error: { detail: "Family service is unavailable." },
        response: new Response(null, { status: 503 }),
      } as never)
      .mockResolvedValueOnce({
        data: {
          id: 1,
          name: "Lim Family",
          created_by: "user-1",
          created_at: "2030-01-01T00:00:00Z",
        },
        response: new Response(null, { status: 201 }),
      });
    renderWizard();

    const familyName = screen.getByLabelText(/family name/i);
    await user.type(familyName, "Lim Family");
    await user.click(screen.getByRole("button", { name: /create family/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /family service is unavailable/i,
    );
    expect(familyName).toHaveValue("Lim Family");

    await user.click(screen.getByRole("button", { name: /create family/i }));
    expect(
      await screen.findByRole("heading", { name: /what makes support comfortable/i }),
    ).toBeVisible();
    expect(post).toHaveBeenCalledTimes(2);
  });

  it("updates an existing family and profile through patch requests", async () => {
    const user = userEvent.setup();
    mockedProgress.mockReturnValue(
      progress({
        family: {
          id: 1,
          name: "Lim Family",
        },
        olderAdult: {
          id: 2,
          family_id: 1,
          name: "Mary Lim",
        },
      }) as never,
    );
    const patchRequest = vi.spyOn(fetchClient, "PATCH").mockResolvedValue({
      data: {
        id: 2,
        family_id: 1,
        name: "Mary Lim",
        created_by: "user-1",
        created_at: "2030-01-01T00:00:00Z",
      },
      response: new Response(null, { status: 200 }),
    });
    renderWizard();

    await user.click(screen.getByRole("button", { name: /back/i }));
    await user.click(screen.getByRole("button", { name: /back/i }));
    const familyName = screen.getByLabelText(/family name/i);
    await user.clear(familyName);
    await user.type(familyName, "Lim Family");
    await user.click(
      screen.getByRole("button", { name: /save and continue/i }),
    );

    expect(patchRequest).toHaveBeenCalledWith(
      "/api/families/{family_id}",
      {
        params: { path: { family_id: 1 } },
        body: { name: "Lim Family" },
      },
    );

    await user.click(
      screen.getByRole("button", { name: /save and continue/i }),
    );

    expect(patchRequest).toHaveBeenCalledWith(
      "/api/older-adults/{older_adult_id}",
      expect.objectContaining({
        params: { path: { older_adult_id: 2 } },
        body: expect.objectContaining({
          name: "Mary Lim",
        }),
      }),
    );
  });

  it("resumes at profile details and saves the profile", async () => {
    const user = userEvent.setup();
    mockedProgress.mockReturnValue(
      progress({ family: { id: 1, name: "Lim Family" } }) as never,
    );
    vi.spyOn(fetchClient, "POST").mockResolvedValueOnce({
      data: {
        id: 2,
        family_id: 1,
        name: "Mary Lim",
        created_by: "user-1",
        created_at: "2030-01-01T00:00:00Z",
      },
      response: new Response(null, { status: 201 }),
    });
    renderWizard();

    await user.type(screen.getByLabelText(/full name/i), "Mary Lim");
    await user.click(
      screen.getByRole("button", { name: /save and continue/i }),
    );

    expect(fetchClient.POST).toHaveBeenCalledWith(
      "/api/older-adults",
      expect.objectContaining({
        body: expect.objectContaining({
          family_id: 1,
          name: "Mary Lim",
        }),
      }),
    );
  });

  it("preserves profile fields while navigating back", async () => {
    const user = userEvent.setup();
    mockedProgress.mockReturnValue(
      progress({ family: { id: 1, name: "Lim Family" } }) as never,
    );
    vi.spyOn(fetchClient, "PATCH").mockResolvedValue({
      data: { id: 1, name: "Lim Family", created_by: "user-1", created_at: "2030-01-01T00:00:00Z" },
      response: new Response(null, { status: 200 }),
    } as never);
    renderWizard();

    await user.type(screen.getByLabelText(/full name/i), "Mary Lim");
    await user.type(screen.getByLabelText(/preferred language/i), "English");
    await user.click(screen.getByRole("button", { name: /back/i }));

    expect(screen.getByLabelText(/family name/i)).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: /save and continue/i }),
    );

    expect(await screen.findByLabelText(/full name/i)).toHaveValue("Mary Lim");
    expect(screen.getByLabelText(/preferred language/i)).toHaveValue("English");
  });

  it("requires at least one relationship before saving a family member", async () => {
    const user = userEvent.setup();
    mockedProgress.mockReturnValue(
      progress({
        family: { id: 1, name: "Lim Family" },
        olderAdult: OLDER_ADULT,
        olderAdults: [OLDER_ADULT],
      }) as never,
    );
    renderWizard();

    await user.type(screen.getByLabelText(/^name/i), "Anna Lim");
    await user.type(screen.getByLabelText(/^email/i), "anna@example.com");
    await user.click(screen.getByRole("button", { name: /add family member/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /how this person is related/i,
    );
  });

  it("creates and edits family members with the correct identifiers", async () => {
    const user = userEvent.setup();
    mockedProgress.mockReturnValue(
      progress({
        family: { id: 1, name: "Lim Family" },
        olderAdult: OLDER_ADULT,
        olderAdults: [OLDER_ADULT],
        familyMembers: [familyMember()],
      }) as never,
    );
    const post = vi.spyOn(fetchClient, "POST").mockResolvedValue({
      data: familyMember({ id: 4, name: "David", relationship: "Son" }),
      response: new Response(null, { status: 201 }),
    } as never);
    const patchRequest = vi.spyOn(fetchClient, "PATCH").mockResolvedValue({
      data: familyMember({ name: "Anna Lim" }),
      response: new Response(null, { status: 200 }),
    } as never);
    renderWizard();

    await user.type(screen.getByLabelText(/^name/i), "David");
    await user.type(screen.getByLabelText(/^email/i), "david@example.com");
    await user.type(screen.getByLabelText(/relationship to mary/i), "Son");
    await user.click(screen.getByRole("button", { name: /add family member/i }));

    expect(post).toHaveBeenCalledWith("/api/family-members", {
      body: {
        family_id: 1,
        name: "David",
        email: "david@example.com",
        relationships: [{ older_adult_id: 2, relationship: "Son" }],
      },
    });

    await user.click(screen.getByRole("button", { name: /edit/i }));
    const editName = screen.getByLabelText(/^name/i);
    await user.clear(editName);
    await user.type(editName, "Anna Lim");
    await user.click(screen.getByRole("button", { name: /save family member/i }));

    expect(patchRequest).toHaveBeenCalledWith(
      "/api/family-members/{family_member_id}",
      {
        params: { path: { family_member_id: 3 } },
        body: {
          name: "Anna Lim",
          email: "anna@example.com",
          relationships: [{ older_adult_id: 2, relationship: "Daughter" }],
        },
      },
    );
  });

  it("removes a family member only after confirmation", async () => {
    const user = userEvent.setup();
    mockedProgress.mockReturnValue(
      progress({
        family: { id: 1, name: "Lim Family" },
        olderAdult: OLDER_ADULT,
        olderAdults: [OLDER_ADULT],
        familyMembers: [familyMember()],
      }) as never,
    );
    const remove = vi.spyOn(fetchClient, "DELETE").mockResolvedValue({
      data: undefined,
      response: new Response(null, { status: 204 }),
    } as never);
    const confirm = vi
      .spyOn(window, "confirm")
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    renderWizard();

    await user.click(screen.getByRole("button", { name: /remove/i }));
    expect(remove).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /remove/i }));

    expect(confirm).toHaveBeenCalledWith("Remove this family member?");
    expect(remove).toHaveBeenCalledWith(
      "/api/family-members/{family_member_id}",
      { params: { path: { family_member_id: 3 } } },
    );
  });

  it("shows each relationship against the older adult it belongs to", () => {
    const second = { ...OLDER_ADULT, id: 7, name: "Robert Lim", preferred_name: "Robert" };
    mockedProgress.mockReturnValue(
      progress({
        family: { id: 1, name: "Lim Family" },
        olderAdult: OLDER_ADULT,
        olderAdults: [OLDER_ADULT, second],
        familyMembers: [
          familyMember({
            relationships: [
              { older_adult_id: 2, relationship: "Daughter" },
              { older_adult_id: 7, relationship: "Sister" },
            ],
          }),
        ],
      }) as never,
    );
    renderWizard();

    expect(
      screen.getByText(/Daughter of Mary · Sister of Robert/),
    ).toBeVisible();
  });

  it("allows a completed setup to continue to discovery", async () => {
    const user = userEvent.setup();
    mockedProgress.mockReturnValue(
      progress({
        family: { id: 1, name: "Lim Family" },
        olderAdult: OLDER_ADULT,
        olderAdults: [OLDER_ADULT],
        familyMembers: [familyMember()],
        isComplete: true,
      }) as never,
    );
    renderWizard();

    await user.click(screen.getByRole("button", { name: /finish setup/i }));
    expect(navigate).toHaveBeenCalledWith({ to: "/discover" });
  });



  it("surfaces a duplicate family member from the API", async () => {
    const user = userEvent.setup();
    mockedProgress.mockReturnValue(
      progress({
        family: { id: 1, name: "Lim Family" },
        olderAdult: OLDER_ADULT,
        olderAdults: [OLDER_ADULT],
        familyMembers: [familyMember()],
      }) as never,
    );
    vi.spyOn(fetchClient, "POST").mockResolvedValue({
      error: { detail: "This email address is already a family member." },
      response: new Response(null, { status: 409 }),
    } as never);
    renderWizard();

    await user.type(screen.getByLabelText(/^name/i), "Anna Again");
    await user.type(screen.getByLabelText(/^email/i), "anna@example.com");
    await user.type(screen.getByLabelText(/relationship to mary/i), "Daughter");
    await user.click(screen.getByRole("button", { name: /add family member/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /already a family member/i,
    );
  });
});
