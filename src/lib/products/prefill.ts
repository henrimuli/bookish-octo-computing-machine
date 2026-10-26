import { decodeEntities, findTags, pageTitle } from "@/lib/html";

export type Prefill = {
  url: string;
  name?: string;
  tagline?: string;
  description?: string;
  logoUrl?: string;
  imageUrl?: string;
  twitterUrl?: string;
};

function clean(s: string | undefined, max: number): string | undefined {
  if (!s) return undefined;
  const v = decodeEntities(s).replace(/\s+/g, " ").trim();
  return v ? v.slice(0, max) : undefined;
}

function absolute(href: string | undefined, base: string): string | undefined {
  if (!href) return undefined;
  try {
    const u = new URL(href, base);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

/** Site names often come as "Product - Tagline" or "Product | Tagline". */
function splitTitle(title: string): { name: string; rest?: string } {
  const parts = title.split(/\s+[|\-–—:·]\s+/);
  if (parts.length >= 2 && parts[0].length <= 40) return { name: parts[0], rest: parts.slice(1).join(" – ") };
  return { name: title };
}

/** Extracts listing details from a page's HTML. Pure; the caller fetches the page. */
export function extractPrefill(html: string, pageUrl: string): Prefill {
  const metas = findTags(html, "meta");
  const meta = (key: string) =>
    metas.find((m) => (m.property ?? m.name ?? "").toLowerCase() === key && m.content)?.content;

  const ogSiteName = clean(meta("og:site_name"), 60);
  const title = clean(meta("og:title") ?? pageTitle(html), 120);
  const split = title ? splitTitle(title) : undefined;
  const description = clean(meta("og:description") ?? meta("description") ?? meta("twitter:description"), 600);

  const links = findTags(html, "link");
  const iconRank = (rel: string) =>
    rel.includes("apple-touch-icon") ? 0 : rel.split(/\s+/).includes("icon") ? 1 : rel.includes("shortcut") ? 2 : 9;
  const icon = links
    .filter((l) => l.href && iconRank((l.rel ?? "").toLowerCase()) < 9)
    .sort((a, b) => iconRank((a.rel ?? "").toLowerCase()) - iconRank((b.rel ?? "").toLowerCase()))[0];

  const twitterHandle = meta("twitter:site") ?? meta("twitter:creator");
  const handle = twitterHandle?.replace(/^@/, "").trim();

  const name = ogSiteName ?? split?.name;
  // Prefer a short title remainder as the tagline; fall back to the description's first sentence.
  const tagline =
    (split?.rest && split.rest.length <= 80 ? split.rest : undefined) ??
    clean(description?.split(/(?<=[.!?])\s/)[0], 80);

  return {
    url: pageUrl,
    name: clean(name, 60),
    tagline,
    description,
    logoUrl: absolute(icon?.href, pageUrl) ?? absolute("/favicon.ico", pageUrl),
    imageUrl: absolute(meta("og:image") ?? meta("twitter:image"), pageUrl),
    twitterUrl: handle && /^[A-Za-z0-9_]{1,15}$/.test(handle) ? `https://x.com/${handle}` : undefined,
  };
}
