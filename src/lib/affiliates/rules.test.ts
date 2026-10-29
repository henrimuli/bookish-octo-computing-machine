// AFFILIATES PAUSED. The affiliate program is switched off for now, not
// deleted: everything below is commented out so it can be restored as is.
// To turn it back on, uncomment the files listed in src/lib/affiliates/PAUSED.md
// and the call sites marked "Affiliates are paused".

// import { describe, expect, it } from "vitest";
// import { commissionCents, isAffiliateCode } from "./rules";
//
// describe("affiliate rules", () => {
//   it("accepts simple lowercase codes only", () => {
//     expect(isAffiliateCode("ada-builds")).toBe(true);
//     expect(isAffiliateCode("Ada")).toBe(false);
//     expect(isAffiliateCode("a")).toBe(false);
//     expect(isAffiliateCode("x".repeat(33))).toBe(false);
//     expect(isAffiliateCode(undefined)).toBe(false);
//   });
//
//   it("pays 30% rounded down", () => {
//     expect(commissionCents(17900, 30)).toBe(5370);
//     expect(commissionCents(999, 30)).toBe(299);
//   });
// });

import { it } from "vitest";

it.skip("affiliates are paused", () => {});
