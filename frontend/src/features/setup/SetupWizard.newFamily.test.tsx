import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SetupWizard } from "@/features/setup/SetupWizard";
import { fetchClient } from "@/lib/fetchClient";
import { createQueryClient } from "@/lib/queryClient";

// Unlike SetupWizard.test.tsx, this exercises the real useSetupProgress hook
// (that file mocks it out), because the bug this guards against only shows up
// once the wizard's own family-creation flow feeds back into that hook.
function renderWizard() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <SetupWizard />
    </QueryClientProvider>,
  );
}

describe("SetupWizard creating a brand new family", () => {
  it("shows the family members step once the family and profile are saved, instead of a blank section", async () => {
    const user = userEvent.setup();
    let families: Array<{ id: number; name: string }> = [];
    let olderAdults: Array<{ id: number; family_id: number; name: string }> = [];

    vi.spyOn(fetchClient, "GET").mockImplementation(async (path) => {
      if (path === "/api/families") {
        return {
          data: { families },
          response: new Response(null, { status: 200 }),
        } as never;
      }
      if (path === "/api/families/{family_id}/older-adults") {
        return {
          data: { older_adults: olderAdults },
          response: new Response(null, { status: 200 }),
        } as never;
      }
      if (path === "/api/families/{family_id}/family-members") {
        return {
          data: { family_members: [] },
          response: new Response(null, { status: 200 }),
        } as never;
      }
      throw new Error(`Unexpected GET ${String(path)}`);
    });

    vi.spyOn(fetchClient, "POST").mockImplementation(async (path, options) => {
      if (path === "/api/families") {
        const { body } = options as { body: { name: string } };
        families = [{ id: 1, name: body.name }];
        return {
          data: {
            id: 1,
            name: body.name,
            created_by: "user-1",
            created_at: "2030-01-01T00:00:00Z",
          },
          response: new Response(null, { status: 201 }),
        } as never;
      }
      if (path === "/api/older-adults") {
        const { body } = options as {
          body: { name: string; family_id: number };
        };
        olderAdults = [{ id: 2, family_id: body.family_id, name: body.name }];
        return {
          data: {
            id: 2,
            family_id: body.family_id,
            name: body.name,
            created_by: "user-1",
            created_at: "2030-01-01T00:00:00Z",
          },
          response: new Response(null, { status: 201 }),
        } as never;
      }
      throw new Error(`Unexpected POST ${String(path)}`);
    });

    renderWizard();

    await user.type(
      await screen.findByLabelText(/family name/i),
      "Lim Family",
    );
    await user.click(screen.getByRole("button", { name: /create family/i }));

    await user.type(await screen.findByLabelText(/full name/i), "Mary Lim");
    await user.click(
      screen.getByRole("button", { name: /save and continue/i }),
    );

    expect(
      await screen.findByRole("heading", { name: /who is in the family/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("button", { name: /add family member/i }),
    ).toBeVisible();
  });

  it("shows the organizer's own relationship to the senior as soon as the profile is saved", async () => {
    const user = userEvent.setup();
    let families: Array<{ id: number; name: string }> = [];
    let olderAdults: Array<{ id: number; family_id: number; name: string }> = [];

    // Mirrors the backend: creating the older adult is what makes the
    // organizer's own "Organizer" family-member relationship exist, and every
    // list read reflects whatever older adults currently exist for the family.
    vi.spyOn(fetchClient, "GET").mockImplementation(async (path) => {
      if (path === "/api/families") {
        return {
          data: { families },
          response: new Response(null, { status: 200 }),
        } as never;
      }
      if (path === "/api/families/{family_id}/older-adults") {
        return {
          data: { older_adults: olderAdults },
          response: new Response(null, { status: 200 }),
        } as never;
      }
      if (path === "/api/families/{family_id}/family-members") {
        const familyMembers = olderAdults.length
          ? [
              {
                id: 99,
                family_id: olderAdults[0].family_id,
                name: "Organizer",
                email: "organizer@example.com",
                relationships: olderAdults.map((person) => ({
                  older_adult_id: person.id,
                  relationship: "Organizer",
                })),
                created_at: "2030-01-01T00:00:00Z",
                is_account_owner: true,
              },
            ]
          : [];
        return {
          data: { family_members: familyMembers },
          response: new Response(null, { status: 200 }),
        } as never;
      }
      throw new Error(`Unexpected GET ${String(path)}`);
    });

    vi.spyOn(fetchClient, "POST").mockImplementation(async (path, options) => {
      if (path === "/api/families") {
        const { body } = options as { body: { name: string } };
        families = [{ id: 1, name: body.name }];
        return {
          data: {
            id: 1,
            name: body.name,
            created_by: "user-1",
            created_at: "2030-01-01T00:00:00Z",
          },
          response: new Response(null, { status: 201 }),
        } as never;
      }
      if (path === "/api/older-adults") {
        const { body } = options as {
          body: { name: string; family_id: number };
        };
        olderAdults = [{ id: 2, family_id: body.family_id, name: body.name }];
        return {
          data: {
            id: 2,
            family_id: body.family_id,
            name: body.name,
            created_by: "user-1",
            created_at: "2030-01-01T00:00:00Z",
          },
          response: new Response(null, { status: 201 }),
        } as never;
      }
      throw new Error(`Unexpected POST ${String(path)}`);
    });

    renderWizard();

    await user.type(
      await screen.findByLabelText(/family name/i),
      "Lim Family",
    );
    await user.click(screen.getByRole("button", { name: /create family/i }));

    await user.type(await screen.findByLabelText(/full name/i), "Mary Lim");
    await user.click(
      screen.getByRole("button", { name: /save and continue/i }),
    );

    await screen.findByRole("heading", { name: /who is in the family/i });
    expect(
      await screen.findByText(/organizer of mary lim/i),
    ).toBeVisible();
  });
});
