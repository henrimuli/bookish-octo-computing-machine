/** Plain-English results for the free dofollow checker. Pure. */

export type LinkVerdict = "dofollow" | "nofollow" | "missing" | "unreachable";

export function explainLink(
  v: { verdict: LinkVerdict; rel: string | null; httpStatus: number | null },
  domain: string,
) {
  switch (v.verdict) {
    case "dofollow":
      return `The page links to ${domain} with a followed link, so it passes link equity.`;
    case "nofollow": {
      const rels = (v.rel ?? "nofollow").split(/\s+/).filter((r) => ["nofollow", "ugc", "sponsored"].includes(r));
      return `The page links to ${domain}, but the link is marked rel="${rels.join(" ") || "nofollow"}", so search engines treat it as a hint rather than a vote.`;
    }
    case "missing":
      return `We loaded the page but found no link to ${domain}. It may be added by JavaScript after load, which crawlers often don't see.`;
    case "unreachable":
      return v.httpStatus
        ? `The page returned HTTP ${v.httpStatus}, so we couldn't check it.`
        : "We couldn't load the page.";
  }
}

/** "example.com", from a bare domain or any URL on it. Throws on junk. */
export function toDomain(raw: string): string {
  const v = raw.trim();
  const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
  if (!u.hostname.includes(".")) throw new Error("not a domain");
  return u.hostname.toLowerCase().replace(/^www\./, "");
}
