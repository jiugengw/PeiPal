import { isTrustedContactPath } from "@/app/App";

describe("isTrustedContactPath", () => {
  it("allows the family portal itself", () => {
    expect(isTrustedContactPath("/family-portal")).toBe(true);
  });

  it("allows plan detail pages, since a trusted contact can be linked to one from their portal", () => {
    expect(isTrustedContactPath("/plans/42")).toBe(true);
  });

  it("blocks household-side pages", () => {
    expect(isTrustedContactPath("/discover")).toBe(false);
    expect(isTrustedContactPath("/setup")).toBe(false);
    expect(isTrustedContactPath("/family")).toBe(false);
    expect(isTrustedContactPath("/")).toBe(false);
  });
});
