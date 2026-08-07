import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActivityResultsList } from "@/features/activities/ActivityResultsList";
import type { Activity } from "@/features/activities/types";

function activity(overrides: Partial<Activity> = {}): Activity {
  return {
    databaseId: 1,
    dedupeKey: "senior-yoga-bishan",
    title: "Senior Yoga",
    venue: "Bishan Community Club",
    startsAt: new Date("2030-06-01T09:00:00Z"),
    endsAt: null,
    cost: 0,
    currency: "SGD",
    description: "A gentle seated class.",
    tags: [],
    infoLink: null,
    signupLink: null,
    ...overrides,
  };
}

function baseProps(
  overrides: Partial<Parameters<typeof ActivityResultsList>[0]> = {},
) {
  return {
    activities: [],
    locationFilter: "",
    onClearLocation: vi.fn(),
    onSelect: vi.fn(),
    query: { isPending: false, isError: false, refetch: vi.fn() } as never,
    selectedDedupeKey: null,
    ...overrides,
  };
}

describe("ActivityResultsList", () => {
  it("shows a loading status while the query is pending", () => {
    render(
      <ActivityResultsList
        {...baseProps({
          query: { isPending: true, isError: false, refetch: vi.fn() } as never,
        })}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(/loading activities/i);
  });

  it("offers a retry action on error", async () => {
    const user = userEvent.setup();
    const refetch = vi.fn();
    render(
      <ActivityResultsList
        {...baseProps({
          query: { isPending: false, isError: true, refetch } as never,
        })}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      /could not load activities/i,
    );
    await user.click(screen.getByRole("button", { name: /try again/i }));
    expect(refetch).toHaveBeenCalled();
  });

  it("shows a location-clear action in the empty state when a location filter is applied", async () => {
    const user = userEvent.setup();
    const onClearLocation = vi.fn();
    render(
      <ActivityResultsList
        {...baseProps({ locationFilter: "Bishan", onClearLocation })}
      />,
    );

    expect(
      screen.getByText(/no activities found near "bishan"/i),
    ).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: /clear location filter/i }),
    );
    expect(onClearLocation).toHaveBeenCalled();
  });

  it("shows a plain empty state without a clear action when there is no location filter", () => {
    render(<ActivityResultsList {...baseProps()} />);

    expect(
      screen.getByText(/no activities are available right now/i),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /clear location filter/i }),
    ).not.toBeInTheDocument();
  });

  it("renders each activity as a ruled list row", () => {
    render(
      <ActivityResultsList
        {...baseProps({
          activities: [
            activity({ dedupeKey: "a", title: "Senior Yoga" }),
            activity({ dedupeKey: "b", title: "Tai Chi" }),
          ],
        })}
      />,
    );

    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByText("Senior Yoga")).toBeVisible();
    expect(screen.getByText("Tai Chi")).toBeVisible();
  });
});
