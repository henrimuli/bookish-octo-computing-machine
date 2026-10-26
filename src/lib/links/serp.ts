/**
 * "Is this listing indexed by Google?" through a SERP API. Each provider's
 * response is parsed by a pure function so the mapping is unit-tested.
 */

export type SerpProviderId = "serpapi" | "dataforseo";

export interface SerpProvider {
  readonly id: SerpProviderId;
  isIndexed(url: string): Promise<boolean>;
}

export class SerpError extends Error {}

/** Compares URLs the way a SERP shows them: no scheme, no www, no trailing slash, case-insensitive host. */
export function normalizeForSerp(raw: string): string {
  try {
    const u = new URL(raw);
    const path = u.pathname.replace(/\/+$/, "");
    return `${u.hostname.toLowerCase().replace(/^www\./, "")}${path}${u.search}`;
  } catch {
    return raw.trim().toLowerCase();
  }
}

/** The query: `site:` the exact listing page. */
export const serpQuery = (url: string) => `site:${normalizeForSerp(url)}`;

const includes = (links: unknown[], url: string) => {
  const want = normalizeForSerp(url);
  return links.some((l) => typeof l === "string" && normalizeForSerp(l) === want);
};

export function parseSerpApi(body: unknown, url: string): boolean {
  const b = body as { error?: string; organic_results?: Array<{ link?: string }> };
  if (b.error && !/hasn't returned any results/i.test(b.error)) throw new SerpError(`SerpApi: ${b.error}`);
  return includes(
    (b.organic_results ?? []).map((r) => r.link),
    url,
  );
}

export function parseDataForSeoSerp(body: unknown, url: string): boolean {
  const task = (
    body as {
      tasks?: Array<{ status_code?: number; result?: Array<{ items?: Array<{ type?: string; url?: string }> }> }>;
    }
  ).tasks?.[0];
  if (!task || (task.status_code && task.status_code >= 40000)) throw new SerpError("DataForSEO SERP task failed");
  const items = task.result?.[0]?.items ?? [];
  return includes(
    items.filter((i) => i.type === "organic").map((i) => i.url),
    url,
  );
}

export function createSerpProvider(id: SerpProviderId, apiKey: string, fetchImpl: typeof fetch = fetch): SerpProvider {
  const timeout = () => AbortSignal.timeout(20_000);
  const ok = async (res: Response, name: string) => {
    if (!res.ok) throw new SerpError(`${name} returned HTTP ${res.status}`);
    return res.json();
  };
  switch (id) {
    case "serpapi":
      return {
        id,
        async isIndexed(url) {
          const q = new URLSearchParams({ engine: "google", q: serpQuery(url), num: "10", api_key: apiKey });
          const res = await fetchImpl(`https://serpapi.com/search.json?${q}`, { signal: timeout() });
          return parseSerpApi(await ok(res, "SerpApi"), url);
        },
      };
    case "dataforseo":
      return {
        id,
        async isIndexed(url) {
          const res = await fetchImpl("https://api.dataforseo.com/v3/serp/google/organic/live/regular", {
            method: "POST",
            headers: {
              Authorization: `Basic ${Buffer.from(apiKey).toString("base64")}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify([{ keyword: serpQuery(url), location_code: 2840, language_code: "en", depth: 10 }]),
            signal: timeout(),
          });
          return parseDataForSeoSerp(await ok(res, "DataForSEO"), url);
        },
      };
  }
}
