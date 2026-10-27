/**
 * Resend webhooks for digest opens and clicks. Pure: Svix signature checks
 * and turning an event into what we store.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export const MAX_SKEW_S = 5 * 60;

/** Svix signs `${id}.${timestamp}.${body}` with the base64 key after `whsec_`. */
export function signSvix(id: string, timestamp: string, body: string, secret: string): string {
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  return `v1,${createHmac("sha256", key).update(`${id}.${timestamp}.${body}`).digest("base64")}`;
}

/** `header` may list several space-separated signatures (secret rotation); any match passes. */
export function verifySvix(
  headers: { id: string | null; timestamp: string | null; signature: string | null },
  body: string,
  secret: string,
  now = Date.now(),
): boolean {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(now / 1000 - Number(timestamp)) > MAX_SKEW_S) return false;
  const want = Buffer.from(signSvix(id, timestamp, body, secret).slice(3));
  return signature.split(" ").some((s) => {
    const [version, sig] = s.split(",");
    const got = Buffer.from(sig ?? "");
    return version === "v1" && got.length === want.length && timingSafeEqual(got, want);
  });
}

export type TrackedEvent = { type: "opened" | "clicked"; weekKey: string; email: string; link?: string; at: Date };

/** Opens and clicks on a tagged digest; anything else (bounces, other mail) is ignored. */
export function parseEvent(payload: unknown): TrackedEvent | null {
  const p = payload as {
    type?: string;
    created_at?: string;
    data?: { to?: string[] | string; tags?: unknown; click?: { link?: string }; created_at?: string };
  } | null;
  const type = p?.type === "email.opened" ? "opened" : p?.type === "email.clicked" ? "clicked" : null;
  if (!type || !p?.data) return null;
  const tags = p.data.tags;
  // Resend sends tags as an object; older payloads used [{ name, value }].
  const weekKey = Array.isArray(tags)
    ? (tags as Array<{ name?: string; value?: string }>).find((t) => t.name === "issue")?.value
    : (tags as Record<string, string> | undefined)?.issue;
  const to = Array.isArray(p.data.to) ? p.data.to[0] : p.data.to;
  if (!weekKey || !to) return null;
  const at = new Date(p.created_at ?? p.data.created_at ?? Date.now());
  return {
    type,
    weekKey,
    email: to.toLowerCase(),
    link: type === "clicked" ? p.data.click?.link?.slice(0, 1000) : undefined,
    at: Number.isNaN(at.getTime()) ? new Date() : at,
  };
}
