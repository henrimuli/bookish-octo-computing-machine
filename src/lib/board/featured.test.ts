import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: () => ({}) }));
const { isFeaturedNow, isHeroNow } = await import("./featured");

describe("featured windows", () => {
  const week = "2026-W44"; // starts Mon Oct 26 2026
  const at = (iso: string) => new Date(iso);

  it("features Pro for 7 days and Premium/Spotlight for 30 from the debut week's start", () => {
    expect(isFeaturedNow("pro", week, at("2026-10-26T00:00:00Z"))).toBe(true);
    expect(isFeaturedNow("pro", week, at("2026-11-01T23:59:59Z"))).toBe(true);
    expect(isFeaturedNow("pro", week, at("2026-11-02T00:00:00Z"))).toBe(false);
    expect(isFeaturedNow("premium", week, at("2026-11-24T00:00:00Z"))).toBe(true);
    expect(isFeaturedNow("premium", week, at("2026-11-25T00:00:00Z"))).toBe(false);
  });

  it("never features before the debut week or for free/fast-track", () => {
    expect(isFeaturedNow("pro", week, at("2026-10-25T23:59:59Z"))).toBe(false);
    expect(isFeaturedNow("free", week, at("2026-10-27T00:00:00Z"))).toBe(false);
    expect(isFeaturedNow("fast_track", week, at("2026-10-27T00:00:00Z"))).toBe(false);
  });

  it("makes Spotlight the hero only during its debut week", () => {
    expect(isHeroNow("spotlight", week, at("2026-10-30T00:00:00Z"))).toBe(true);
    expect(isHeroNow("spotlight", week, at("2026-11-03T00:00:00Z"))).toBe(false);
    expect(isHeroNow("premium", week, at("2026-10-30T00:00:00Z"))).toBe(false);
  });
});
