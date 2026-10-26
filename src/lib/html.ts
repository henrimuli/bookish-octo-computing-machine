/**
 * Small, dependency-free HTML readers for the few things we need from a page:
 * meta tags, icon links and anchors. Not a general parser; good enough for
 * prefill and badge detection.
 */

export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

/** Parses the attributes of a single tag's source, e.g. `<a href="x" rel=nofollow>`. */
export function parseAttributes(tag: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([^\s=/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+)))?/g;
  const inner = tag.replace(/^<\s*[a-z0-9-]+/i, "").replace(/\/?>$/, "");
  let m: RegExpExecArray | null;
  while ((m = re.exec(inner))) {
    attrs[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? "");
  }
  return attrs;
}

/** Strips comments, scripts and styles so their contents can't match. */
function visibleSource(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style\s*>/gi, "");
}

export function findTags(html: string, name: string): Array<Record<string, string>> {
  const re = new RegExp(`<${name}\\b[^>]*>`, "gi");
  return (visibleSource(html).match(re) ?? []).map(parseAttributes);
}

export type Anchor = { href: string; rel: string[]; inner: string };

/** Anchors with their rel tokens and inner HTML. */
export function findAnchors(html: string): Anchor[] {
  const out: Anchor[] = [];
  const re = /<a\b[^>]*>([\s\S]*?)<\/a\s*>/gi;
  const src = visibleSource(html);
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const open = m[0].slice(0, m[0].indexOf(">") + 1);
    const attrs = parseAttributes(open);
    if (!attrs.href) continue;
    out.push({ href: attrs.href, rel: (attrs.rel ?? "").toLowerCase().split(/\s+/).filter(Boolean), inner: m[1] });
  }
  return out;
}

export function pageTitle(html: string): string | undefined {
  const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  return m ? decodeEntities(m[1]).replace(/\s+/g, " ").trim() : undefined;
}
