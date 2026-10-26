import { describe, expect, it } from "vitest";
import { cpcCents, remainingByWeek, shouldExtend } from "./placements";

describe("shouldExtend (CPC guarantee)", () => {
  const base = { placement: "leaderboard" as const, paidCents: 1500, extensions: 0 };
  it("extends while cost per click is over $1", () => {
    expect(shouldExtend({ ...base, clicks: 0 })).toBe(true);
    expect(shouldExtend({ ...base, clicks: 14 })).toBe(true);
    expect(shouldExtend({ ...base, clicks: 15 })).toBe(false);
  });
  it("stops after the extension limit, for comped slots, and where not offered", () => {
    expect(shouldExtend({ ...base, clicks: 0, extensions: 4 })).toBe(false);
    expect(shouldExtend({ ...base, clicks: 0, paidCents: 0 })).toBe(false);
    expect(shouldExtend({ ...base, clicks: 0, placement: "home_top" })).toBe(false);
  });
  it("computes CPC", () => {
    expect(cpcCents(1500, 0)).toBeNull();
    expect(cpcCents(1500, 7)).toBe(214);
  });
});

describe("remainingByWeek", () => {
  const d = (s: string) => new Date(`${s}T00:00:00Z`);
  const weeks = [
    { key: "A", startsAt: d("2026-11-02"), endsAt: d("2026-11-09") },
    { key: "B", startsAt: d("2026-11-09"), endsAt: d("2026-11-16") },
  ];
  it("counts bookings that overlap each week", () => {
    const month = { startsAt: d("2026-10-19"), paidEndsAt: d("2026-11-09") };
    const weekB = { startsAt: d("2026-11-09"), paidEndsAt: d("2026-11-16") };
    expect(remainingByWeek(weeks, [month, weekB, weekB], 2)).toEqual({ A: 1, B: 0 });
  });
});
