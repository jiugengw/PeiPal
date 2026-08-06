import {
  formatActivityCost,
  formatActivityWhen,
} from "@/features/activities/format";

describe("formatActivityWhen", () => {
  it("returns a placeholder when the start time is unknown", () => {
    expect(formatActivityWhen({ startsAt: null, endsAt: null })).toBe(
      "Time to be confirmed",
    );
  });

  it("formats a date and single time when there is no end time", () => {
    const result = formatActivityWhen({
      startsAt: new Date("2030-06-01T09:00:00Z"),
      endsAt: null,
    });

    expect(result).toMatch(/\d{1,2}:\d{2}/);
    expect(result).not.toMatch(/–/);
  });

  it("formats a time range when an end time is present", () => {
    const result = formatActivityWhen({
      startsAt: new Date("2030-06-01T09:00:00Z"),
      endsAt: new Date("2030-06-01T11:00:00Z"),
    });

    expect(result).toContain("–");
  });
});

describe("formatActivityCost", () => {
  it("reports unavailable pricing rather than treating it as free", () => {
    expect(
      formatActivityCost({ cost: null, currency: "SGD", priceRemarks: null }),
    ).toBe("Price unavailable");
  });

  it("reports zero cost as free", () => {
    expect(
      formatActivityCost({ cost: 0, currency: "SGD", priceRemarks: null }),
    ).toBe("Free");
  });

  it("formats a positive cost using the activity currency", () => {
    const result = formatActivityCost({
      cost: 12,
      currency: "SGD",
      priceRemarks: null,
    });

    expect(result).toMatch(/12/);
  });

  it("appends price remarks when present", () => {
    const result = formatActivityCost({
      cost: 0,
      currency: "SGD",
      priceRemarks: "Includes a mat rental",
    });

    expect(result).toBe("Free · Includes a mat rental");
  });

  it("falls back gracefully for an unrecognized currency code", () => {
    const result = formatActivityCost({
      cost: 5,
      currency: "not-a-currency",
      priceRemarks: null,
    });

    expect(result).toContain("5");
  });
});
