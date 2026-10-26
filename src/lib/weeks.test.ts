import { describe, expect, it } from "vitest";
import { addWeeks, formatWeekRange, isWeekKey, upcomingWeekKeys, weekBounds, weekKeyFor, weekStart } from "./weeks";

describe("weeks", () => {
  it("starts weeks on Monday 00:00 UTC", () => {
    expect(weekStart(new Date("2026-10-28T15:00:00Z")).toISOString()).toBe("2026-10-26T00:00:00.000Z");
    expect(weekStart(new Date("2026-11-01T23:59:59Z")).toISOString()).toBe("2026-10-26T00:00:00.000Z");
    expect(weekStart(new Date("2026-11-02T00:00:00Z")).toISOString()).toBe("2026-11-02T00:00:00.000Z");
  });

  it("computes ISO week keys, including year boundaries", () => {
    expect(weekKeyFor(new Date("2026-10-26T00:00:00Z"))).toBe("2026-W44");
    expect(weekKeyFor(new Date("2027-01-01T12:00:00Z"))).toBe("2026-W53");
    expect(weekKeyFor(new Date("2025-12-29T00:00:00Z"))).toBe("2026-W01");
    expect(weekKeyFor(new Date("2027-01-04T00:00:00Z"))).toBe("2027-W01");
  });

  it("round-trips keys and bounds", () => {
    for (const key of ["2026-W01", "2026-W44", "2026-W53", "2027-W01"]) {
      const { startsAt, endsAt } = weekBounds(key);
      expect(weekKeyFor(startsAt)).toBe(key);
      expect(endsAt.getTime() - startsAt.getTime()).toBe(7 * 24 * 3600 * 1000);
    }
  });

  it("validates keys", () => {
    expect(isWeekKey("2026-W44")).toBe(true);
    expect(isWeekKey("2027-W53")).toBe(false); // 2027 has 52 ISO weeks
    expect(isWeekKey("2026-44")).toBe(false);
    expect(() => weekBounds("nope")).toThrow();
  });

  it("steps weeks across years", () => {
    expect(addWeeks("2026-W52", 1)).toBe("2026-W53");
    expect(addWeeks("2026-W53", 1)).toBe("2027-W01");
    expect(addWeeks("2027-W01", -1)).toBe("2026-W53");
    expect(upcomingWeekKeys(new Date("2026-10-28T00:00:00Z"), 3)).toEqual(["2026-W45", "2026-W46", "2026-W47"]);
  });

  it("formats week ranges", () => {
    expect(formatWeekRange("2026-W44")).toBe("Oct 26 – Nov 1, 2026");
  });
});
