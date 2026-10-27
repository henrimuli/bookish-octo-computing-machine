import { randomBytes } from "node:crypto";

/** Per-order inbox helpers: addresses and verification links. Pure. */

const KEY = /^[a-z0-9]{6,16}$/;
const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

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

/**
 * Recipients of a Resend `email.received` event worth checking, envelope
 * recipients (`received_for`, which covers BCC and forwards) first. Null when
 * the event isn't a received email.
 */
export function receivedEvent(payload: unknown): { emailId: string; recipients: string[] } | null {
  const p = payload as { type?: string; data?: { email_id?: unknown; to?: unknown; received_for?: unknown } } | null;
  if (p?.type !== "email.received" || typeof p.data?.email_id !== "string") return null;
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
  const recipients = [...new Set([...list(p.data.received_for), ...list(p.data.to)])];
  return { emailId: p.data.email_id, recipients };
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
