import { Marked, type Tokens } from "marked";

/**
 * Markdown → HTML for blog posts. Raw HTML in the source is escaped, and links
 * and images only keep http(s), mailto and site-relative URLs, because recaps
 * quote maker-written names and taglines.
 */

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function safeHref(href: string): string | null {
  const h = href.trim();
  if (h.startsWith("/") && !h.startsWith("//")) return h;
  if (h.startsWith("#")) return h;
  try {
    const u = new URL(h);
    return ["http:", "https:", "mailto:"].includes(u.protocol) ? u.toString() : null;
  } catch {
    return null;
  }
}

const isExternal = (href: string) => /^https?:/i.test(href);

const md = new Marked({ gfm: true, breaks: false });
md.use({
  renderer: {
    html({ text }: Tokens.HTML | Tokens.Tag) {
      return escapeHtml(text);
    },
    link({ href, title, tokens }: Tokens.Link) {
      const text = this.parser.parseInline(tokens);
      const safe = safeHref(href);
      if (!safe) return text;
      const rel = isExternal(safe) ? ` rel="noopener nofollow ugc" target="_blank"` : "";
      return `<a href="${escapeHtml(safe)}"${title ? ` title="${escapeHtml(title)}"` : ""}${rel}>${text}</a>`;
    },
    image({ href, title, text }: Tokens.Image) {
      const safe = safeHref(href);
      if (!safe || safe.startsWith("mailto:")) return escapeHtml(text);
      return `<img src="${escapeHtml(safe)}" alt="${escapeHtml(text)}"${title ? ` title="${escapeHtml(title)}"` : ""} loading="lazy" />`;
    },
  },
});

export function renderMarkdown(source: string): string {
  return md.parse(source, { async: false }) as string;
}

/** Escapes text so it renders literally inside generated markdown. */
export function escapeMarkdown(s: string): string {
  return s
    .replace(/([\\`*_{}[\]()#+\-.!|<>~])/g, "\\$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** Plain-text excerpt for listings and meta descriptions. */
export function excerptFrom(source: string, max = 180): string {
  const plain = source
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^#+\s+.*$/gm, " ")
    .replace(/\\([\\`*_{}[\]()#+\-.!|<>~])/g, "$1")
    .replace(/[*_`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return plain.length > max ? `${plain.slice(0, max - 1).trimEnd()}…` : plain;
}
