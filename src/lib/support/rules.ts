import type { Block } from "@/lib/email-template";

/** Pure helpers for the support inbox (server and browser): addresses, threading and turning typed text into email blocks. */

const KEY_CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
/** 12 random lowercase letters and digits; mail servers may lowercase addresses. */
export const newReplyKey = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) => KEY_CHARS[b % 36]).join("");

/** "Ada <ada@x.io>" → { name: "Ada", email: "ada@x.io" }. */
export function parseAddress(raw: string): { name: string | null; email: string } {
  const m = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim() || null, email: m[2].trim().toLowerCase() };
  return { name: null, email: raw.trim().toLowerCase() };
}

/**
 * Whether `address` is the support inbox: support@domain, or support+{key}@domain,
 * the per-thread reply address. Returns the key ("" for the bare address) or null.
 */
export function supportKeyFrom(address: string, supportEmail: string): string | null {
  const [local, domain] = supportEmail.toLowerCase().split("@");
  const { email } = parseAddress(address);
  const at = email.lastIndexOf("@");
  if (at < 0 || email.slice(at + 1) !== domain) return null;
  const box = email.slice(0, at);
  if (box === local) return "";
  if (box.startsWith(`${local}+`)) return box.slice(local.length + 1).replace(/[^a-z0-9]/g, "") || "";
  return null;
}

/** support+{key}@domain, where customers' replies come back to. */
export function replyAddress(key: string, supportEmail: string): string {
  const [local, domain] = supportEmail.split("@");
  return `${local}+${key}@${domain}`;
}

/** Strips "Re:", "Fwd:" and friends so a reply matches its conversation. */
export function baseSubject(subject: string): string {
  return subject.replace(/^(\s*(re|fw|fwd|aw|sv)\s*(\[\d+\])?\s*:\s*)+/i, "").trim();
}

export function replySubject(subject: string): string {
  return /^\s*re\s*:/i.test(subject) ? subject : `Re: ${baseSubject(subject) || subject}`;
}

/** Message-IDs named in In-Reply-To and References, most recent first. */
export function referencedIds(inReplyTo: string | null | undefined, references: string | null | undefined): string[] {
  const ids = `${inReplyTo ?? ""} ${references ?? ""}`.match(/<[^<>\s]+>/g) ?? [];
  return [...new Set(ids.reverse())];
}

/** A header from Resend's (lowercased or not) header map. */
export function header(headers: Record<string, string> | null | undefined, name: string): string | null {
  if (!headers) return null;
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name.toLowerCase());
  return key ? headers[key] : null;
}

/**
 * The hidden reference we put in References on every email we send, carrying
 * the thread's key. Replies echo References back, so they find their thread
 * while the customer only ever sees support@ as the address.
 */
export function threadRef(key: string, supportEmail: string): string {
  return `<thread.${key}@${supportEmail.split("@")[1]}>`;
}

/** The thread key in one of our hidden references, or null. */
export function keyFromRefs(refs: string[], supportEmail: string): string | null {
  const suffix = `@${supportEmail.split("@")[1]}>`.toLowerCase();
  for (const r of refs) {
    const ref = r.toLowerCase();
    if (!ref.startsWith("<thread.") || !ref.endsWith(suffix)) continue;
    const key = ref.slice("<thread.".length, -suffix.length);
    if (/^[a-z0-9]+$/.test(key)) return key;
  }
  return null;
}

// Where a mail client starts the quoted history: "On … wrote:" (possibly wrapped
// over two lines), Outlook's "Original Message" or a "From:/Sent:" header block.
const QUOTE_START =
  /\n[ \t]*(?:On\s[^\n]{3,200}(?:\n[^\n]{0,200})?\swrote:[ \t]*(?:\n|$)|-{2,} ?(?:Original|Forwarded) Message|From: [^\n]+\n(?:Sent|Date): )/i;

/** A message split into what the sender wrote and the history their mail client quoted under it. */
export function splitQuoted(text: string): { own: string; quoted: string } {
  const t = `\n${text.replace(/\r\n/g, "\n")}`;
  const at = t.search(QUOTE_START);
  let own = at === -1 ? t : t.slice(0, at);
  let quoted = at === -1 ? "" : t.slice(at).trim();
  // Trailing "> …" lines without a header are quoting too.
  const lines = own.trimEnd().split("\n");
  let cut = lines.length;
  while (cut > 0 && (lines[cut - 1].startsWith(">") || (cut < lines.length && !lines[cut - 1].trim()))) cut--;
  if (cut < lines.length && lines.slice(0, cut).some((l) => l.trim())) {
    quoted = [lines.slice(cut).join("\n").trim(), quoted].filter(Boolean).join("\n");
    own = lines.slice(0, cut).join("\n");
  }
  return { own: own.trim(), quoted };
}

/** First line or so of a message, for the list view. Drops quoted history. */
export function snippetFrom(text: string, max = 140): string {
  const { own } = splitQuoted(text);
  const flat = own
    .split("\n")
    .filter((l) => !l.startsWith(">"))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/**
 * Typed text → template blocks: blank lines make paragraphs, "- " lines make
 * bullets, and [label](url) links are kept for the template to render.
 */
export function bodyToBlocks(body: string): Block[] {
  const blocks: Block[] = [];
  for (const chunk of body.replace(/\r\n/g, "\n").split(/\n\s*\n/)) {
    const lines = chunk.split("\n").map((l) => l.trimEnd());
    if (lines.every((l) => !l.trim())) continue;
    if (lines.every((l) => /^\s*[-*•]\s+/.test(l) || !l.trim())) {
      blocks.push({ bullets: lines.filter((l) => l.trim()).map((l) => l.replace(/^\s*[-*•]\s+/, "")) });
    } else {
      blocks.push({ text: lines.join("\n").trim() });
    }
  }
  return blocks;
}

/** "On 30 Oct 2026, 14:02, Ada Okafor wrote:" */
export function quoteCite(at: Date, who: string): string {
  const when = at.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
  return `On ${when} UTC, ${who} wrote:`;
}

/**
 * Received HTML for display in a sandboxed frame: links open in a new tab and,
 * unless `images` is on, remote images are blocked by a CSP (tracking pixels).
 */
export function displayHtml(html: string, images: boolean): string {
  const csp = images
    ? "default-src 'none'; img-src * data: cid:; style-src 'unsafe-inline' *; font-src *"
    : "default-src 'none'; img-src data:; style-src 'unsafe-inline'";
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><base target="_blank"><style>body{margin:0;padding:12px;font:14px/1.5 -apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#10201B;background:#fff;word-break:break-word}img{max-width:100%;height:auto}</style></head><body>${html}</body></html>`;
}

/** HTML with the quoted history of a reply (Gmail, Apple Mail, Outlook) cut off. */
export function stripQuotedHtml(html: string): string {
  const at = html.search(
    /<div[^>]+class="?[^">]*gmail_quote|<blockquote|<div[^>]+id="?(?:divRplyFwdMsg|appendonsend)/i,
  );
  return at === -1 ? html : html.slice(0, at);
}

/**
 * Whether an email's own HTML is designed (tables, images, colours) rather
 * than plain writing. Plain writing is shown as text in the page's theme;
 * designed email keeps its own light background.
 */
export function isRichHtml(html: string | null): boolean {
  if (!html) return false;
  return /<(?:table|img)\b|bgcolor|background(?:-color)?\s*:|[^-]color\s*:/i.test(stripQuotedHtml(html));
}

export function hasRemoteImages(html: string | null): boolean {
  return Boolean(html && /<img[^>]+src\s*=\s*["']?https?:/i.test(html));
}
