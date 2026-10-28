import { describe, expect, it } from "vitest";
import { addWeeks, weekKeyFor } from "@/lib/weeks";
import { BOOKABLE_WEEKS, bookableWeeks, paidWeek } from "./schedule";

// A Wednesday, so "this week" is already under way.
const now = new Date("2026-10-28T12:00:00Z");
const thisWeek = weekKeyFor(now);

describe("bookableWeeks", () => {
  it("starts with this week, then the next eight", () => {
    const weeks = bookableWeeks(now);
    expect(weeks).toHaveLength(BOOKABLE_WEEKS + 1);
    expect(weeks[0]).toBe(thisWeek);
    expect(weeks.at(-1)).toBe(addWeeks(thisWeek, BOOKABLE_WEEKS));
  });
});

describe("paidWeek", () => {
  it("puts every paid tier into this week by default, so it's live on approval", () => {
    for (const tier of ["fast_track", "pro", "premium", "spotlight"] as const) {
      expect(paidWeek(tier, null, now)).toBe(thisWeek);
    }
  });

  it("keeps a later week a Pro maker booked", () => {
    const later = addWeeks(thisWeek, 3);
    expect(paidWeek("pro", later, now)).toBe(later);
  });

  it("ignores a requested week for Fast Track", () => {
    expect(paidWeek("fast_track", addWeeks(thisWeek, 3), now)).toBe(thisWeek);
  });

  it("falls back to now for a passed, too-far or malformed week", () => {
    expect(paidWeek("premium", addWeeks(thisWeek, -1), now)).toBe(thisWeek);
    expect(paidWeek("premium", addWeeks(thisWeek, BOOKABLE_WEEKS + 1), now)).toBe(thisWeek);
    expect(paidWeek("premium", "soon", now)).toBe(thisWeek);
  });
});
