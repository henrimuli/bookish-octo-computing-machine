import { describe, expect, it } from "vitest";
import { commissionCents, isAffiliateCode } from "./rules";

describe("affiliate rules", () => {
  it("accepts simple lowercase codes only", () => {
    expect(isAffiliateCode("ada-builds")).toBe(true);
    expect(isAffiliateCode("Ada")).toBe(false);
    expect(isAffiliateCode("a")).toBe(false);
    expect(isAffiliateCode("x".repeat(33))).toBe(false);
    expect(isAffiliateCode(undefined)).toBe(false);
  });

  it("pays 30% rounded down", () => {
    expect(commissionCents(17900, 30)).toBe(5370);
    expect(commissionCents(999, 30)).toBe(299);
  });
});
