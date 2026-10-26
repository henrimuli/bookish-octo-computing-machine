import { describe, expect, it } from "vitest";
import { formatMonthLabel, isMonthKey, monthKeyOfWeek, periodEnded, weeksInPeriod, yearKeyOfWeek } from "./periods";

describe("periods", () => {
  it("assigns a week to the month and year of its Monday", () => {
    expect(monthKeyOfWeek("2026-W44")).toBe("2026-10"); // Mon Oct 26
    expect(monthKeyOfWeek("2026-W14")).toBe("2026-03"); // Mon Mar 30, ends in April
    expect(yearKeyOfWeek("2026-W53")).toBe("2026"); // Mon Dec 28 2026
    expect(yearKeyOfWeek("2026-W01")).toBe("2025"); // Mon Dec 29 2025
  });

  it("lists the weeks whose Monday falls in a month or year", () => {
    // Oct 1 2026 is a Thursday: W40 (Mon Sep 28) belongs to September.
    expect(weeksInPeriod("2026-10")).toEqual(["2026-W41", "2026-W42", "2026-W43", "2026-W44"]);
    // November has five Mondays (2, 9, 16, 23, 30).
    expect(weeksInPeriod("2026-11")).toEqual(["2026-W45", "2026-W46", "2026-W47", "2026-W48", "2026-W49"]);
    const year = weeksInPeriod("2026");
    expect(year[0]).toBe("2026-W02");
    expect(year.at(-1)).toBe("2026-W53");
    expect(year).toHaveLength(52);
  });

  it("ends a period when its last week ends", () => {
    expect(periodEnded("2026-10", new Date("2026-11-01T23:59:59Z"))).toBe(false);
    expect(periodEnded("2026-10", new Date("2026-11-02T00:00:00Z"))).toBe(true);
  });

  it("validates and formats keys", () => {
    expect(isMonthKey("2026-10")).toBe(true);
    expect(isMonthKey("2026-13")).toBe(false);
    expect(formatMonthLabel("2026-10")).toBe("October 2026");
  });
});
