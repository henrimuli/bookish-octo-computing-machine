import { findAnchors } from "@/lib/html";

export type BadgeCheck = { ok: true } | { ok: false; reason: "not_found" | "nofollow"; detail: string };

const BLOCKING_REL = ["nofollow", "sponsored", "ugc"];

/**
 * Looks for a followed link to any of `ourHosts` in the page HTML. Pure.
 * The badge must be in the served HTML: script-injected badges don't count,
 * because we (like most directories) check without running JavaScript.
 */
export function detectBadge(html: string, pageUrl: string, ourHosts: string[]): BadgeCheck {
  const hosts = new Set(ourHosts.map((h) => h.toLowerCase().replace(/^www\./, "")));
  let sawNofollow = false;
  for (const a of findAnchors(html)) {
    let host: string;
    try {
      host = new URL(a.href, pageUrl).hostname.toLowerCase().replace(/^www\./, "");
    } catch {
      continue;
    }
    if (!hosts.has(host)) continue;
    if (a.rel.some((r) => BLOCKING_REL.includes(r))) {
      sawNofollow = true;
      continue;
    }
    return { ok: true };
  }
  return sawNofollow
    ? {
        ok: false,
        reason: "nofollow",
        detail: 'Found a link to DebutYard, but it has rel="nofollow", "sponsored" or "ugc". Remove that attribute.',
      }
    : { ok: false, reason: "not_found", detail: "No link to DebutYard found on the page." };
}

/** TXT record value for the DNS fallback. */
export function dnsRecordValue(token: string): string {
  return `debutyard-verification=${token}`;
}
