import { canReach, homePathFor } from "@/app/roleAccess";

describe("homePathFor", () => {
  it("sends the older adult to /discover", () => {
    expect(homePathFor("older_adult")).toBe("/discover");
  });

  it.each(["organizer", "unknown"] as const)(
    "sends %s to /family",
    (role) => {
      expect(homePathFor(role)).toBe("/family");
    },
  );
});

describe("canReach", () => {
  it.each(["organizer", "unknown"] as const)(
    "lets %s reach /family and /setup, but not /discover or /plans",
    (role) => {
      expect(canReach(role, "/family")).toBe(true);
      expect(canReach(role, "/setup")).toBe(true);
      expect(canReach(role, "/discover")).toBe(false);
      expect(canReach(role, "/plans")).toBe(false);
    },
  );

  it("lets the older adult reach /discover, /plans, and /family, but not /setup", () => {
    expect(canReach("older_adult", "/discover")).toBe(true);
    expect(canReach("older_adult", "/plans")).toBe(true);
    expect(canReach("older_adult", "/family")).toBe(true);
    expect(canReach("older_adult", "/setup")).toBe(false);
  });

  it("matches nested paths, not just exact ones", () => {
    expect(canReach("organizer", "/plans/42")).toBe(false);
    expect(canReach("older_adult", "/setup/anything")).toBe(false);
  });
});
