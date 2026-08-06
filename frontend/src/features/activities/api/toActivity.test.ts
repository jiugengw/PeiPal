import type { components } from "@/generated/api";
import { toActivity } from "@/features/activities/api/toActivity";

type ActivityResponse = components["schemas"]["ActivityResponse"];

function response(overrides: Partial<ActivityResponse> = {}): ActivityResponse {
  return {
    id: 42,
    dedupe_key: "senior-yoga-bishan-2030-01-01",
    name: "Senior Yoga",
    location: "Bishan Community Club",
    start_at: "2030-01-01T02:00:00Z",
    currency: "SGD",
    info_link: "https://example.com/senior-yoga",
    status: "active",
    first_seen_at: "2029-12-01T00:00:00Z",
    last_seen_at: "2029-12-15T00:00:00Z",
    last_checked_at: "2029-12-15T00:00:00Z",
    ...overrides,
  } as ActivityResponse;
}

describe("toActivity", () => {
  it("preserves the numeric database ID separately from the dedupe key", () => {
    const activity = toActivity(response());

    expect(activity.databaseId).toBe(42);
    expect(activity.dedupeKey).toBe("senior-yoga-bishan-2030-01-01");
  });

  it("maps display fields from the backend response", () => {
    const activity = toActivity(
      response({
        name: "Senior Yoga",
        location: "Bishan Community Club",
        description: "A gentle seated class.",
        tags: ["gentle", "seated"],
        cost: 12,
        price_remarks: "Includes a mat rental",
        mobility_notes: "Wheelchair accessible",
        slots_availability: "3 spots left",
        signup_link: "https://example.com/signup",
      }),
    );

    expect(activity.title).toBe("Senior Yoga");
    expect(activity.venue).toBe("Bishan Community Club");
    expect(activity.description).toBe("A gentle seated class.");
    expect(activity.tags).toEqual(["gentle", "seated"]);
    expect(activity.cost).toBe(12);
    expect(activity.priceRemarks).toBe("Includes a mat rental");
    expect(activity.mobilityNotes).toBe("Wheelchair accessible");
    expect(activity.slotsAvailability).toBe("3 spots left");
    expect(activity.infoLink).toBe("https://example.com/senior-yoga");
    expect(activity.signupLink).toBe("https://example.com/signup");
  });

  it("parses the start and end times into Dates", () => {
    const activity = toActivity(
      response({
        start_at: "2030-06-01T09:00:00Z",
        end_at: "2030-06-01T11:00:00Z",
      }),
    );

    expect(activity.startsAt).toEqual(new Date("2030-06-01T09:00:00Z"));
    expect(activity.endsAt).toEqual(new Date("2030-06-01T11:00:00Z"));
  });

  it("falls back to null and empty defaults for optional fields", () => {
    const activity = toActivity(
      response({
        description: null,
        cost: null,
        price_remarks: null,
        tags: null,
        mobility_notes: null,
        slots_availability: null,
        signup_link: null,
        end_at: null,
      }),
    );

    expect(activity.description).toBe("");
    expect(activity.cost).toBeNull();
    expect(activity.priceRemarks).toBeNull();
    expect(activity.tags).toEqual([]);
    expect(activity.mobilityNotes).toBeNull();
    expect(activity.slotsAvailability).toBeNull();
    expect(activity.signupLink).toBeNull();
    expect(activity.endsAt).toBeNull();
  });

  it("treats an unparsable start time as unconfirmed rather than throwing", () => {
    const activity = toActivity(response({ start_at: "not-a-date" }));

    expect(activity.startsAt).toBeNull();
  });
});
