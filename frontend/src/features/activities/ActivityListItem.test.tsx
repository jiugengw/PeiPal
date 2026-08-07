import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActivityListItem } from "@/features/activities/ActivityListItem";
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
    priceRemarks: null,
    description: "A gentle seated class.",
    tags: ["gentle", "seated"],
    mobilityNotes: null,
    slotsAvailability: null,
    infoLink: "https://example.com/senior-yoga",
    signupLink: null,
    ...overrides,
  };
}

describe("ActivityListItem", () => {
  it("does not show the description until expanded", () => {
    render(
      <ActivityListItem
        activity={activity()}
        isSelected={false}
        onSelect={vi.fn()}
      />,
    );

    expect(
      screen.queryByText("A gentle seated class."),
    ).not.toBeInTheDocument();
  });

  it("reveals details without affecting selection when expanded", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <ActivityListItem
        activity={activity()}
        isSelected={false}
        onSelect={onSelect}
      />,
    );

    await user.click(screen.getByRole("button", { name: /tell me more/i }));

    expect(screen.getByText("A gentle seated class.")).toBeVisible();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("calls onSelect with the full activity when chosen", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const target = activity();
    render(
      <ActivityListItem
        activity={target}
        isSelected={false}
        onSelect={onSelect}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: /choose this activity/i }),
    );

    expect(onSelect).toHaveBeenCalledWith(target);
  });

  it("shows a written selected state and disables the choose action", () => {
    render(
      <ActivityListItem activity={activity()} isSelected onSelect={vi.fn()} />,
    );

    expect(screen.getAllByText("Selected")).toHaveLength(2);
    expect(screen.getByRole("button", { name: /^selected$/i })).toBeDisabled();
  });

  it("opens the info link safely in a new tab", async () => {
    const user = userEvent.setup();
    render(
      <ActivityListItem
        activity={activity()}
        isSelected={false}
        onSelect={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: /tell me more/i }));

    const link = screen.getByRole("link", { name: /more information/i });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });
});
