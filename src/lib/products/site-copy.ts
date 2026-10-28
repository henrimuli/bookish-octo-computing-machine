import { parse, type HTMLElement } from "node-html-parser";

/**
 * Listing copy built from a product's own website, with no AI: read the hero,
 * feature blocks, schema.org data, pricing and audience cues from a page or
 * two, then assemble a tagline and descriptions from a fixed template. Pure;
 * the caller fetches the pages. Quality follows the site's own wording.
 */

export type PricingModel = "free" | "freemium" | "paid" | "open_source" | "trial";

export type PageFacts = {
  /** The page's main heading. */
  hero?: string;
  /** The first real sentence or subheading after the hero. */
  subhead?: string;
  /** Short feature names (headings over a blurb, or list items under a features heading). */
  features: string[];
  /** Prose sentences in page order, boilerplate removed. */
  sentences: string[];
  /** From schema.org JSON-LD, when the page has it. */
  ld: { description?: string; free?: boolean; price?: Price };
  pricing: { free: boolean; trial: boolean; openSource: boolean; price?: Price };
  /** Who it's for, e.g. "developers and designers". */
  audience?: string;
  githubUrl?: string;
  twitterUrl?: string;
  /** Same-site pages worth reading next, best first. */
  more: string[];
};

type Price = { amount: number; label: string };

export type SiteCopy = {
  tagline?: string;
  shortDescription?: string;
  description?: string;
  pricingModel?: PricingModel;
  githubUrl?: string;
  twitterUrl?: string;
  /** Extra words for category scoring. */
  keywords: string;
};

// Elements that never hold the product's own description.
const NOISE = "script, style, noscript, svg, template, iframe, nav, footer, form, dialog, blockquote, figure, button";
// Whole class/id words only, so "preview" or "reviewer-card" don't match.
const NOISE_ATTR =
  /(^|[\s_-])(cookies?|consent|gdpr|testimonials?|reviews|newsletter|announcement|banner-cookie)([\s_-]|$)/i;
const BOILERPLATE =
  /cookie|privacy|terms of|©|copyright|all rights reserved|sign ?up|log ?in|subscribe|newsletter|enable javascript|javascript is (required|disabled)|update your browser|unsubscribe|we use|trusted by|loved by|testimonial|book a demo|contact (us|sales)/i;
const FILLER =
  /\b(revolutionary|world-class|cutting-edge|game[- ]?chang\w*|best-in-class|next-gen\w*|#1|unparalleled)\b/i;
const NOT_FEATURE =
  /^(pricing|plans?|faq|frequently asked|testimonials?|reviews?|get started|start now|sign up|contact|about( us)?|blog|resources|customers|integrations|trusted by|join|ready to|what (people|our)|loved by|try it|support|company|product|legal)\b/i;
const FEATURE_SECTION =
  /feature|why|how it works|what you get|everything you need|benefits|capabilities|what's included/i;
const AUDIENCES = [
  "developers",
  "designers",
  "founders",
  "indie hackers",
  "makers",
  "marketers",
  "product teams",
  "engineering teams",
  "teams",
  "startups",
  "small businesses",
  "agencies",
  "freelancers",
  "creators",
  "writers",
  "students",
  "researchers",
  "recruiters",
  "sales teams",
  "support teams",
  "ecommerce stores",
  "shopify stores",
  "remote teams",
  "solo founders",
];
const IMPERATIVES = new Set(
  (
    "build ship create make launch track manage send write turn get find grow automate design collect monitor plan " +
    "share run save sell organize organise connect deploy analyze analyse start keep focus meet learn edit generate " +
    "convert schedule publish capture sync test debug measure understand protect secure scale simplify streamline " +
    "accept invoice host store record transcribe translate summarize summarise answer chat code review book hire " +
    "close win reach engage boost cut reduce spend stay go see know control discover explore"
  ).split(" "),
);
// Same-site pages that describe updates or posts rather than the product.
const SKIP_PATH =
  /\/(blog|changelog|news|updates|releases|docs?|help|careers|jobs|legal|privacy|terms|status|login|signup|sign-up)(\/|$)/;
const GITHUB_RESERVED =
  /^(features|about|pricing|login|join|sponsors|marketplace|explore|topics|enterprise|team|security|site|orgs|apps|settings|contact)$/i;

const squash = (s: string) => s.replace(/\s+/g, " ").trim();
const textOf = (el: HTMLElement) => squash(el.structuredText);
const words = (s: string) => new Set(s.toLowerCase().match(/[a-z0-9]+/g) ?? []);

function similar(a: string, b: string): boolean {
  const wa = words(a);
  const wb = words(b);
  if (!wa.size || !wb.size) return false;
  let shared = 0;
  for (const w of wa) if (wb.has(w)) shared++;
  return shared / Math.min(wa.size, wb.size) > 0.6;
}

function sentencesIn(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"“])/)
    .map(squash)
    .filter(Boolean);
}

/** A readable sentence: prose length, mostly letters, not a CTA or legal line. */
function isProse(s: string, min = 40, max = 240): boolean {
  if (s.length < min || s.length > max) return false;
  if (BOILERPLATE.test(s) || s.endsWith("?")) return false;
  const letters = s.replace(/[^a-z]/gi, "").length;
  return letters / s.length > 0.7 && s.split(" ").length >= 6;
}

function endSentence(s: string): string {
  const t = s.trim().replace(/[,;:\s–—-]+$/, "");
  return /[.!?]$/.test(t) ? t : `${t}.`;
}

/** Cuts at a word boundary so the result (with "…") fits in `max` characters. */
export function fitTo(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.slice(0, max - 1);
  const at = cut.lastIndexOf(" ");
  return `${(at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[,;:.\s–—-]+$/, "")}…`;
}

function lowerFirst(s: string): string {
  // Keep acronyms and brand words ("AI", "GitHub") as written.
  return /^[A-Z][a-z]/.test(s) && !/^[A-Z][a-z]+[A-Z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s;
}

function parsePrice(text: string): Price | undefined {
  const re =
    /([$€£])\s?(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:usd|eur|gbp)?\s*(?:\/|per\s+|a\s+)\s*(month|mo|user|seat|year|yr)\b/gi;
  let best: Price | undefined;
  for (const m of text.matchAll(re)) {
    let amount = Number(m[2].replace(",", "."));
    const unit = m[3].toLowerCase();
    const yearly = unit === "year" || unit === "yr";
    if (yearly) amount = Math.round((amount / 12) * 100) / 100;
    if (!(amount > 0)) continue;
    const per = unit === "user" || unit === "seat" ? `/${unit}/month` : "/month";
    const shown = Number.isInteger(amount) ? String(amount) : amount.toFixed(2);
    if (!best || amount < best.amount) best = { amount, label: `${m[1]}${shown}${per}` };
  }
  return best;
}

type LdNode = Record<string, unknown>;

function ldNodes(root: HTMLElement): LdNode[] {
  const out: LdNode[] = [];
  const visit = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === "object") {
      const node = v as LdNode;
      out.push(node);
      if (node["@graph"]) visit(node["@graph"]);
    }
  };
  for (const s of root.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      visit(JSON.parse(s.textContent));
    } catch {
      // Malformed JSON-LD is common; skip it.
    }
  }
  return out;
}

function readLd(root: HTMLElement): PageFacts["ld"] {
  const rank = (n: LdNode) => {
    const t = [n["@type"]].flat().map(String).join(" ");
    return /Application|Product|Service/.test(t) ? 0 : /Organization|WebSite|Corporation/.test(t) ? 1 : 9;
  };
  const nodes = ldNodes(root)
    .filter((n) => rank(n) < 9)
    .sort((a, b) => rank(a) - rank(b));
  const description = nodes
    .map((n) => (typeof n.description === "string" ? squash(n.description) : ""))
    .find((d) => d.length >= 40);
  let free: boolean | undefined;
  let price: Price | undefined;
  for (const n of nodes) {
    for (const o of [n.offers].flat().filter(Boolean) as LdNode[]) {
      const amount = Number(o.price ?? o.lowPrice);
      if (!Number.isFinite(amount)) continue;
      if (amount === 0) free = true;
      else if (!price || amount < price.amount) {
        const sym = { USD: "$", EUR: "€", GBP: "£" }[String(o.priceCurrency ?? "USD").toUpperCase()] ?? "$";
        price = { amount, label: `${sym}${Number.isInteger(amount) ? amount : amount.toFixed(2)}` };
      }
    }
  }
  return { description, free, price };
}

function socialLinks(root: HTMLElement): Pick<PageFacts, "githubUrl" | "twitterUrl"> {
  let github: string | undefined;
  let githubRepo: string | undefined;
  let twitter: string | undefined;
  for (const a of root.querySelectorAll("a[href]")) {
    let u: URL;
    try {
      u = new URL(a.getAttribute("href") ?? "");
    } catch {
      continue;
    }
    const host = u.hostname.replace(/^www\./, "");
    const parts = u.pathname.split("/").filter(Boolean);
    if (host === "github.com" && parts[0] && !GITHUB_RESERVED.test(parts[0])) {
      if (parts[1] && !githubRepo) githubRepo = `https://github.com/${parts[0]}/${parts[1].replace(/\.git$/, "")}`;
      github ??= `https://github.com/${parts[0]}`;
    } else if ((host === "x.com" || host === "twitter.com") && parts.length === 1) {
      const h = parts[0].replace(/^@/, "");
      if (/^[A-Za-z0-9_]{1,15}$/.test(h) && !/^(intent|share|home|i|search|hashtag)$/i.test(h)) {
        twitter ??= `https://x.com/${h}`;
      }
    }
  }
  return { githubUrl: githubRepo ?? github, twitterUrl: twitter };
}

function morePages(root: HTMLElement, pageUrl: string): string[] {
  const base = new URL(pageUrl);
  const found: Record<"features" | "about" | "pricing", string | undefined> = {
    features: undefined,
    about: undefined,
    pricing: undefined,
  };
  for (const a of root.querySelectorAll("a[href]")) {
    let u: URL;
    try {
      u = new URL(a.getAttribute("href") ?? "", base);
    } catch {
      continue;
    }
    if (u.host !== base.host || !/^https?:$/.test(u.protocol)) continue;
    u.hash = "";
    if (u.pathname === base.pathname) continue;
    const path = u.pathname.toLowerCase();
    if (SKIP_PATH.test(path)) continue;
    // The path, or a nav label that is just the page name ("Features", "Pricing").
    const label = textOf(a).toLowerCase();
    const kind =
      /\/(features?|how-it-works)(\/|$)/.test(path) || /^(features|how it works)$/.test(label)
        ? "features"
        : /\/(pricing|plans)(\/|$)/.test(path) || /^(pricing|plans)$/.test(label)
          ? "pricing"
          : /\/(about|why[\w-]*)(\/|$)/.test(path) || /^(about|about us)$/.test(label)
            ? "about"
            : undefined;
    if (kind) found[kind] ??= u.toString();
  }
  return [found.features, found.pricing, found.about].filter((u): u is string => Boolean(u));
}

function findAudience(text: string): string | undefined {
  const lower = text.toLowerCase();
  const hits = AUDIENCES.map((a) => ({
    a,
    n: (lower.match(new RegExp(`\\bfor ${a.replace(/ /g, "\\s+")}\\b`, "g")) ?? []).length,
  }))
    .filter((h) => h.n > 0)
    .sort((x, y) => y.n - x.n);
  // "teams" is covered by a more specific hit like "product teams".
  const picked = hits.filter((h, i) => !hits.slice(0, i).some((p) => p.a.endsWith(h.a) || h.a.endsWith(p.a)));
  return picked.length
    ? picked
        .slice(0, 2)
        .map((h) => h.a)
        .join(" and ")
    : undefined;
}

// The service reads the homepage twice (pages to follow, then the copy); parse it once.
let last: { html: string; pageUrl: string; facts: PageFacts } | undefined;

/** Reads the facts listing copy is built from. */
export function readPage(html: string, pageUrl: string): PageFacts {
  if (last && last.html === html && last.pageUrl === pageUrl) return last.facts;
  const facts = readUncached(html, pageUrl);
  last = { html, pageUrl, facts };
  return facts;
}

function readUncached(html: string, pageUrl: string): PageFacts {
  const root = parse(html, { comment: false });
  const ld = readLd(root);
  const social = socialLinks(root);
  const more = morePages(root, pageUrl);

  for (const el of root.querySelectorAll(NOISE)) el.remove();
  for (const el of root.querySelectorAll("[class], [id], [role], [aria-hidden]")) {
    const attrs = `${el.getAttribute("class") ?? ""} ${el.getAttribute("id") ?? ""}`;
    if (
      NOISE_ATTR.test(attrs) ||
      el.getAttribute("aria-hidden") === "true" ||
      /navigation|contentinfo/.test(el.getAttribute("role") ?? "")
    ) {
      el.remove();
    }
  }
  const main = root.querySelector("main") ?? root.querySelector("body") ?? root;
  const blocks = main.querySelectorAll("h1, h2, h3, h4, p, li");

  const heroIndex = blocks.findIndex((b) => b.tagName === "H1" && textOf(b).length >= 3 && textOf(b).length <= 120);
  const hero = heroIndex >= 0 ? textOf(blocks[heroIndex]) : undefined;
  const subhead = blocks
    .slice(heroIndex + 1, heroIndex + 6)
    .map(textOf)
    .find((t) => isProse(t, 30, 260));

  const features: string[] = [];
  const addFeature = (raw: string) => {
    // Numbered steps ("1. Connect your calendar") keep their words; changelog-style headings don't count.
    const f = raw.replace(/^\d+\s*[.)]\s*/, "").trim();
    if (/^(introducing|announcing|now available|new:)(\s|$)/i.test(f) || !/[a-z]{3}/i.test(f)) return;
    if (f.length < 3 || f.length > 60 || NOT_FEATURE.test(f) || /[?]$/.test(f) || BOILERPLATE.test(f)) return;
    if (!features.some((x) => similar(x, f))) features.push(f);
  };
  let inFeatureSection = false;
  blocks.forEach((b, i) => {
    const t = textOf(b);
    if (/^H[1-4]$/.test(b.tagName) && i !== heroIndex) {
      inFeatureSection = b.tagName === "H2" ? FEATURE_SECTION.test(t) : inFeatureSection;
      // A short heading with a blurb underneath reads as a feature.
      const next = blocks[i + 1];
      if (/^H[34]$/.test(b.tagName) && next?.tagName === "P" && textOf(next).length >= 20) addFeature(t);
    } else if (b.tagName === "LI" && inFeatureSection && !b.querySelector("li")) {
      addFeature(t);
    }
  });

  const seen: string[] = [];
  const sentences: string[] = [];
  for (const p of main.querySelectorAll("p")) {
    for (const s of sentencesIn(textOf(p))) {
      if (!isProse(s) || seen.some((x) => similar(x, s))) continue;
      seen.push(s);
      sentences.push(s);
    }
  }

  const visible = squash(main.structuredText);
  const lower = visible.toLowerCase();
  const pricing = {
    free:
      ld.free === true ||
      /\bfree (plan|tier|forever|to (start|use|try))\b|\b(start|get started|try it|sign up) (for )?free\b|\$0\b|\bfree for\b/.test(
        lower,
      ),
    trial: /\bfree trial\b|\b\d+[- ]day (free )?trial\b|\btry (it )?free for\b/.test(lower),
    // "Open-source SDKs" or "we sponsor open source projects" describe parts or causes, not the product.
    openSource:
      /\bopen[- ]source\b(?!\s+(sdks?|librar(y|ies)|clients?|plugins?|integrations?|components?|packages?|examples?|templates?|starters?|projects?|contributions?|community|software we))|\bmit licen[sc]e\b|\bapache(-| )2/.test(
        lower,
      ),
    price: parsePrice(visible) ?? ld.price,
  };

  return {
    hero,
    subhead,
    features: features.slice(0, 8),
    sentences: sentences.slice(0, 40),
    ld,
    pricing,
    audience: findAudience(visible),
    ...social,
    more,
  };
}

/** "Ship faster" → "Acme helps you ship faster."; "The notes app for teams" → "Acme is the notes app for teams." */
function heroSentence(name: string, hero: string): string | undefined {
  if (hero.length < 8 || similar(hero, name) || hero.toLowerCase().includes(name.toLowerCase())) return undefined;
  const h = hero.replace(/[.!]+$/, "");
  const first = h.split(/\s/)[0].toLowerCase();
  if (/^(the|a|an|your|one)$/.test(first)) return `${name} is ${lowerFirst(h)}.`;
  if (IMPERATIVES.has(first)) return `${name} helps you ${lowerFirst(h)}.`;
  return undefined;
}

function scoreSentence(s: string, name: string): number {
  let score = 0;
  if (s.toLowerCase().includes(name.toLowerCase())) score += 2;
  if (/\byou(r)?\b/i.test(s)) score += 1;
  if (s.length >= 60 && s.length <= 170) score += 1;
  if (FILLER.test(s)) score -= 2;
  if (s.endsWith("!")) score -= 1;
  return score;
}

function pricingModel(p: PageFacts["pricing"]): PricingModel | undefined {
  if (p.openSource) return "open_source";
  if (p.free && p.price) return "freemium";
  if (p.trial && p.price) return "trial";
  if (p.price) return "paid";
  if (p.free) return "free";
  return undefined;
}

/**
 * Builds listing copy from the homepage's facts plus any extra pages read.
 * `meta` is the page's own description and title tagline, used as fallbacks.
 */
export function composeCopy(
  name: string | undefined,
  pages: PageFacts[],
  meta: { description?: string; tagline?: string },
): SiteCopy {
  const [home, ...rest] = pages;
  const product = name ?? "It";
  const pricing = {
    free: pages.some((p) => p.pricing.free),
    trial: pages.some((p) => p.pricing.trial),
    openSource: pages.some((p) => p.pricing.openSource),
    price: pages
      .map((p) => p.pricing.price)
      .filter((x): x is Price => Boolean(x))
      .sort((a, b) => a.amount - b.amount)[0],
  };

  const tagline =
    home?.hero && home.hero.length >= 10 && home.hero.length <= 80 && !similar(home.hero, product)
      ? home.hero.replace(/\.$/, "")
      : meta.tagline;

  const parts: string[] = [];
  const add = (s: string | undefined) => {
    if (!s) return;
    const t = endSentence(s);
    if (!parts.some((p) => similar(p, t))) parts.push(t);
  };

  add(home?.hero && name ? heroSentence(name, home.hero) : undefined);
  const lead = [home?.ld.description, meta.description, home?.subhead].find((d) => d && d.length >= 40);
  if (lead) sentencesIn(lead).slice(0, 2).forEach(add);

  const candidates = [...(home?.sentences ?? []), ...rest.flatMap((p) => p.sentences)]
    .map((s, i) => ({ s, score: scoreSentence(s, product) - i * 0.02 }))
    .filter((c) => c.score >= 1)
    .sort((a, b) => b.score - a.score);
  for (const c of candidates) {
    if (parts.length >= 4) break;
    add(c.s);
  }

  // Features, audience and pricing only feed categories and the Pricing field: written out as
  // "Features include…" / "Free and open source." sentences they were too often wrong.
  const features = pages.flatMap((p) => p.features);
  const audience = pages.map((p) => p.audience).find(Boolean);

  let description = "";
  for (const p of parts) {
    if ((description + " " + p).length > 900) break;
    description = description ? `${description} ${p}` : p;
  }

  const short = parts.find((p) => p.length >= 40);
  return {
    tagline: tagline ? fitTo(tagline, 80) : undefined,
    shortDescription: short ? fitTo(short, 160) : undefined,
    description: description.length >= 40 ? description : meta.description,
    pricingModel: pricingModel(pricing),
    githubUrl: pages.map((p) => p.githubUrl).find(Boolean),
    twitterUrl: pages.map((p) => p.twitterUrl).find(Boolean),
    keywords: [...features, audience, home?.hero, home?.subhead].filter(Boolean).join(" \n "),
  };
}
