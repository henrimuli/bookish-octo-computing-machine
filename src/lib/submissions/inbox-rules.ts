import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** Per-order inbox helpers: addresses, signed inbound posts, verification links. Pure. */

const KEY = /^[a-z0-9]{6,16}$/;
const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";
/** Inbound posts older (or newer) than this are refused, so a captured post can't be replayed later. */
export const INBOUND_MAX_SKEW_MS = 5 * 60_000;

export function newInboxKey(length = 10): string {
  return [...randomBytes(length)].map((b) => ALPHABET[b % ALPHABET.length]).join("");
}

/** The inbox key from an address on our inbound domain ("Acme <k3y@submit.x.com>" → "k3y"), else null. */
export function inboxKeyFrom(address: string, domain: string): string | null {
  const m = /<?([^<>\s@]+)@([^<>\s@]+?)>?\s*$/.exec(address.trim());
  if (!m || m[2].toLowerCase() !== domain.toLowerCase()) return null;
  const local = m[1].toLowerCase().split("+")[0];
  return KEY.test(local) ? local : null;
}

export function signInbound(body: string, timestamp: string, secret: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export function verifyInbound(
  body: string,
  timestamp: string | null,
  signature: string | null,
  secret: string,
  now = Date.now(),
): boolean {
  if (!timestamp || !signature || !/^\d{10,13}$/.test(timestamp)) return false;
  const ms = timestamp.length <= 10 ? Number(timestamp) * 1000 : Number(timestamp);
  if (Math.abs(now - ms) > INBOUND_MAX_SKEW_MS) return false;
  const expected = Buffer.from(signInbound(body, timestamp, secret), "hex");
  const given = Buffer.from(signature.replace(/^sha256=/, ""), "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

const LIKELY = /verif|confirm|activat|validate|magic|token|signup|sign-up|register|complete/i;

/** Links in a message, verification-looking ones first. For staff to click from the ops console. */
export function messageLinks(text: string, html: string | null, limit = 10): Array<{ url: string; likely: boolean }> {
  const found = new Set<string>();
  for (const m of text.matchAll(/https?:\/\/[^\s<>"')\]]+/g)) found.add(m[0].replace(/[.,;:!?]+$/, ""));
  for (const m of (html ?? "").matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    const href = m[1].replace(/&amp;/g, "&");
    if (/^https?:\/\//i.test(href)) found.add(href);
  }
  return [...found]
    .filter((u) => !/unsubscribe|\.(png|jpe?g|gif)(\?|$)/i.test(u))
    .map((url) => ({ url, likely: LIKELY.test(url) }))
    .sort((a, b) => Number(b.likely) - Number(a.likely))
    .slice(0, limit);
}
