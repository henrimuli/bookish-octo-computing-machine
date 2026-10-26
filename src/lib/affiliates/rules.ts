/** Affiliate program rules (PLAN §5.5). Pure; shared by the proxy, checkout and the service. */

export const VIA_COOKIE = "dy_via";
/** How long a referral link counts after the click. */
export const VIA_DAYS = 60;
/** Commissions are approved once the refund window has passed. */
export const APPROVE_AFTER_DAYS = 30;
export const DEFAULT_RATE_PCT = 30;
/** Order kinds that earn a commission: submission packages and paid debuts. */
export const COMMISSIONED_KINDS = ["submission", "launch"] as const;

export const isAffiliateCode = (v: unknown): v is string => typeof v === "string" && /^[a-z0-9-]{3,32}$/.test(v);

/** Commission in cents, rounded down so we never pay out more than the rate. */
export function commissionCents(amountCents: number, ratePct: number): number {
  return Math.floor((amountCents * ratePct) / 100);
}
