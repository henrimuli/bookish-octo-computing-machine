import { describe, expect, it } from "vitest";
import { classifyChange, mapPool, nextCheckAt, normalizeDomain, summarizeChanges } from "./rules";

const DAY = 86_400_000;
const live = new Date("2026-10-01T00:00:00Z");
const after = (days: number) => new Date(live.getTime() + days * DAY);

describe("nextCheckAt", () => {
  it("checks daily for 14 days after going live, then weekly", () => {
    expect(nextCheckAt(live, after(0), 0)).toEqual(after(1));
    expect(nextCheckAt(live, after(13), 0)).toEqual(after(14));
    expect(nextCheckAt(live, after(14), 0)).toEqual(after(21));
  });

  it("re-checks a first failure the next day, then goes back to weekly once it's dead", () => {
    expect(nextCheckAt(live, after(30), 1)).toEqual(after(31));
    expect(nextCheckAt(live, after(31), 2)).toEqual(after(38));
  });
});

describe("classifyChange", () => {
  it("says nothing on the first check", () => {
    expect(classifyChange(null, "nofollow", 0, 0)).toBeNull();
    expect(classifyChange(null, "missing", 0, 1)).toBeNull();
  });

  it("reports a flip to nofollow", () => {
    expect(classifyChange("dofollow", "nofollow", 0, 0)).toBe("nofollow");
    expect(classifyChange("nofollow", "nofollow", 0, 0)).toBeNull();
  });

  it("reports a removal only once it's confirmed, and only once", () => {
    expect(classifyChange("dofollow", "unreachable", 0, 1)).toBeNull();
    expect(classifyChange("unreachable", "missing", 1, 2)).toBe("removed");
    expect(classifyChange("missing", "missing", 2, 3)).toBeNull();
  });

  it("reports recoveries, but not from a blip we never reported", () => {
    expect(classifyChange("nofollow", "dofollow", 0, 0)).toBe("recovered");
    expect(classifyChange("missing", "dofollow", 2, 0)).toBe("recovered");
    expect(classifyChange("unreachable", "dofollow", 1, 0)).toBeNull();
    expect(classifyChange("dofollow", "dofollow", 0, 0)).toBeNull();
  });
});

describe("summarizeChanges", () => {
  it("counts each kind", () => {
    expect(summarizeChanges(["nofollow", "nofollow", "nofollow", "removed"])).toBe(
      "3 links flipped to nofollow, 1 listing removed or unreachable",
    );
    expect(summarizeChanges(["recovered"])).toBe("1 link recovered");
  });
});

describe("normalizeDomain", () => {
  it("accepts domains and URLs", () => {
    expect(normalizeDomain("Acme.io")).toBe("acme.io");
    expect(normalizeDomain("https://www.acme.io/pricing")).toBe("acme.io");
    expect(normalizeDomain("not a domain")).toBeNull();
    expect(normalizeDomain("localhost")).toBeNull();
  });
});

describe("mapPool", () => {
  it("keeps order and caps concurrency", async () => {
    let inFlight = 0;
    let peak = 0;
    const out = await mapPool([1, 2, 3, 4, 5, 6], 2, async (n) => {
      peak = Math.max(peak, ++inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return n * 2;
    });
    expect(out).toEqual([2, 4, 6, 8, 10, 12]);
    expect(peak).toBe(2);
  });
});
