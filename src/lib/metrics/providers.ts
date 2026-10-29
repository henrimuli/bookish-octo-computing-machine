/**
 * Authority Score providers behind one interface (DataForSEO rank, Ahrefs
 * Domain Rating or Open PageRank, all on 0–100). Each parses its own API's
 * response with a pure function so the mapping is unit-tested.
 */

export type DrReading = { dr: number; referringDomains: number | null };
export type DrProviderId = "dataforseo" | "ahrefs" | "openpagerank";

/** Where a score came from, for the "Source:" line under it. */
export const providerLabels: Record<DrProviderId, string> = {
  dataforseo: "DataForSEO",
  ahrefs: "Ahrefs",
  openpagerank: "Open PageRank",
};

export interface DrProvider {
  readonly id: DrProviderId;
  fetchDr(domain: string): Promise<DrReading>;
}

type FetchLike = typeof fetch;

export class DrProviderError extends Error {}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n * 10) / 10));

async function json(res: Response, name: string): Promise<unknown> {
  if (!res.ok) throw new DrProviderError(`${name} returned HTTP ${res.status}`);
  return res.json();
}

/** DataForSEO backlinks/summary: `rank` on a 0–100 scale (we ask for one_hundred). */
export function parseDataForSeo(body: unknown): DrReading {
  const b = body as {
    tasks?: Array<{ status_code?: number; result?: Array<{ rank?: number; referring_domains?: number }> }>;
  };
  const task = b.tasks?.[0];
  const r = task?.result?.[0];
  if (!r || typeof r.rank !== "number") throw new DrProviderError("DataForSEO returned no rank");
  return { dr: clamp(r.rank), referringDomains: r.referring_domains ?? null };
}

/** Ahrefs site-explorer/domain-rating. */
export function parseAhrefs(body: unknown): DrReading {
  const dr = (body as { domain_rating?: { domain_rating?: number } }).domain_rating?.domain_rating;
  if (typeof dr !== "number") throw new DrProviderError("Ahrefs returned no domain rating");
  return { dr: clamp(dr), referringDomains: null };
}

/** Open PageRank: a free 0–10 score, scaled to 0–100 so charts and alerts share a scale. */
export function parseOpenPageRank(body: unknown): DrReading {
  const r = (body as { response?: Array<{ status_code?: number; page_rank_decimal?: number | string }> }).response?.[0];
  const n = r ? Number(r.page_rank_decimal) : NaN;
  if (!r || r.status_code !== 200 || Number.isNaN(n))
    throw new DrProviderError("Open PageRank has no score for that domain");
  return { dr: clamp(n * 10), referringDomains: null };
}

export function createDrProvider(id: DrProviderId, apiKey: string, fetchImpl: FetchLike = fetch): DrProvider {
  const timeout = () => AbortSignal.timeout(15_000);
  switch (id) {
    case "dataforseo":
      return {
        id,
        async fetchDr(domain) {
          const res = await fetchImpl("https://api.dataforseo.com/v3/backlinks/summary/live", {
            method: "POST",
            headers: {
              Authorization: `Basic ${Buffer.from(apiKey).toString("base64")}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify([{ target: domain, include_subdomains: true, rank_scale: "one_hundred" }]),
            signal: timeout(),
          });
          return parseDataForSeo(await json(res, "DataForSEO"));
        },
      };
    case "ahrefs":
      return {
        id,
        async fetchDr(domain) {
          const date = new Date().toISOString().slice(0, 10);
          const res = await fetchImpl(
            `https://api.ahrefs.com/v3/site-explorer/domain-rating?target=${encodeURIComponent(domain)}&date=${date}`,
            { headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" }, signal: timeout() },
          );
          return parseAhrefs(await json(res, "Ahrefs"));
        },
      };
    case "openpagerank":
      return {
        id,
        async fetchDr(domain) {
          const res = await fetchImpl(
            `https://openpagerank.com/api/v1.0/getPageRank?domains%5B0%5D=${encodeURIComponent(domain)}`,
            { headers: { "API-OPR": apiKey }, signal: timeout() },
          );
          return parseOpenPageRank(await json(res, "Open PageRank"));
        },
      };
  }
}

/** How big a drop (in DR points, since the previous snapshot) triggers an alert. */
export const DR_DROP_ALERT = 5;

export type DrPoint = { at: Date; dr: number };

/** "Authority Score 7 → 19 since intake": first and latest reading, and the change. */
export function drChange(points: DrPoint[]): { from: number; to: number; delta: number } | null {
  if (points.length === 0) return null;
  const sorted = [...points].sort((a, b) => a.at.getTime() - b.at.getTime());
  const from = sorted[0].dr;
  const to = sorted[sorted.length - 1].dr;
  return { from, to, delta: Math.round((to - from) * 10) / 10 };
}

/** SVG polyline points for a line chart in a `w`×`h` box with `pad` inside. Pure. */
export function chartPoints(points: DrPoint[], w: number, h: number, pad = 4): Array<[number, number]> {
  if (points.length === 0) return [];
  const sorted = [...points].sort((a, b) => a.at.getTime() - b.at.getTime());
  const t0 = sorted[0].at.getTime();
  const span = sorted[sorted.length - 1].at.getTime() - t0 || 1;
  const values = sorted.map((p) => p.dr);
  const lo = Math.max(0, Math.min(...values) - 5);
  const hi = Math.min(100, Math.max(...values) + 5);
  const range = hi - lo || 1;
  return sorted.map((p) => [
    Math.round((pad + ((p.at.getTime() - t0) / span) * (w - 2 * pad)) * 10) / 10,
    Math.round((h - pad - ((p.dr - lo) / range) * (h - 2 * pad)) * 10) / 10,
  ]);
}
