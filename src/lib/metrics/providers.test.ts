import { describe, expect, it, vi } from "vitest";
import { chartPoints, createDrProvider, drChange, parseAhrefs, parseDataForSeo, parseOpenPageRank } from "./providers";

describe("provider responses", () => {
  it("reads DataForSEO rank and referring domains", () => {
    expect(parseDataForSeo({ tasks: [{ result: [{ rank: 31, referring_domains: 120 }] }] })).toEqual({
      dr: 31,
      referringDomains: 120,
    });
    expect(() => parseDataForSeo({ tasks: [{ result: null }] })).toThrow();
  });

  it("reads Ahrefs domain rating", () => {
    expect(parseAhrefs({ domain_rating: { domain_rating: 42.5, ahrefs_rank: 1 } })).toEqual({
      dr: 42.5,
      referringDomains: null,
    });
    expect(() => parseAhrefs({})).toThrow();
  });

  it("scales Open PageRank's 0-10 to 0-100", () => {
    expect(parseOpenPageRank({ response: [{ status_code: 200, page_rank_decimal: "3.45" }] }).dr).toBe(34.5);
    expect(() => parseOpenPageRank({ response: [{ status_code: 404, page_rank_decimal: 0 }] })).toThrow();
  });

  it("sends the right request", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ response: [{ status_code: 200, page_rank_decimal: 2 }] }));
    const p = createDrProvider("openpagerank", "KEY", fetchImpl as unknown as typeof fetch);
    expect(await p.fetchDr("acme.io")).toEqual({ dr: 20, referringDomains: null });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("domains%5B0%5D=acme.io");
    expect((init.headers as Record<string, string>)["API-OPR"]).toBe("KEY");
  });
});

describe("charts", () => {
  const at = (d: string) => new Date(`2026-${d}T00:00:00Z`);
  const pts = [
    { at: at("10-01"), dr: 7 },
    { at: at("10-15"), dr: 12 },
    { at: at("10-29"), dr: 19 },
  ];

  it("summarises the change since the first reading", () => {
    expect(drChange(pts)).toEqual({ from: 7, to: 19, delta: 12 });
    expect(drChange([])).toBeNull();
  });

  it("maps readings into the box, oldest on the left, higher DR higher up", () => {
    const xy = chartPoints(pts, 200, 60);
    expect(xy[0][0]).toBe(4);
    expect(xy[2][0]).toBe(196);
    expect(xy[2][1]).toBeLessThan(xy[0][1]);
    expect(xy.every(([, y]) => y >= 4 && y <= 56)).toBe(true);
  });
});
