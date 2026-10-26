import { decodeEntities, findAnchors } from "@/lib/html";

export type BacklinkVerdict = "dofollow" | "nofollow" | "missing";
export type Backlink = { verdict: BacklinkVerdict; rel: string | null; anchor: string | null; href: string | null };

const BLOCKING = ["nofollow", "ugc", "sponsored"];
const bare = (host: string) => host.toLowerCase().replace(/^www\./, "");

/**
 * Looks for a link to `targetDomain` (or its subdomains) in a listing page.
 * Pure. A followed link wins over a nofollow one if the page has both.
 */
export function inspectBacklink(html: string, pageUrl: string, targetDomain: string): Backlink {
  const target = bare(targetDomain);
  let blocked: Backlink | null = null;
  for (const a of findAnchors(html)) {
    let host: string;
    try {
      const u = new URL(a.href, pageUrl);
      if (u.protocol !== "http:" && u.protocol !== "https:") continue;
      host = bare(u.hostname);
    } catch {
      continue;
    }
    if (host !== target && !host.endsWith(`.${target}`)) continue;
    const anchor =
      decodeEntities(a.inner.replace(/<img\b[^>]*alt="([^"]*)"[^>]*>/gi, " $1 ").replace(/<[^>]+>/g, " "))
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 200) || null;
    const rel = a.rel.length ? a.rel.join(" ") : null;
    const found = { rel, anchor, href: a.href };
    if (!a.rel.some((r) => BLOCKING.includes(r))) return { verdict: "dofollow", ...found };
    blocked ??= { verdict: "nofollow", ...found };
  }
  return blocked ?? { verdict: "missing", rel: null, anchor: null, href: null };
}
