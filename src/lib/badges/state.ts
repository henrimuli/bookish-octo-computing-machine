export type BadgeStatus = "unverified" | "verified" | "grace" | "missing";

export const GRACE_DAYS = 7;

/**
 * Badge state after a check. A verified badge that disappears gets a 7-day
 * grace period (link stays followed) before turning "missing" (nofollow).
 * Finding the badge again restores "verified" from any state. Pure.
 */
export function nextBadgeState(
  current: { status: BadgeStatus; graceUntil: Date | null },
  found: boolean,
  now = new Date(),
): { status: BadgeStatus; graceUntil: Date | null; notifyMissing: boolean } {
  if (found) return { status: "verified", graceUntil: null, notifyMissing: false };

  switch (current.status) {
    case "verified": {
      const graceUntil = new Date(now.getTime() + GRACE_DAYS * 86_400_000);
      return { status: "grace", graceUntil, notifyMissing: true };
    }
    case "grace":
      return current.graceUntil && current.graceUntil.getTime() > now.getTime()
        ? { status: "grace", graceUntil: current.graceUntil, notifyMissing: false }
        : { status: "missing", graceUntil: null, notifyMissing: false };
    default:
      return { status: current.status, graceUntil: null, notifyMissing: false };
  }
}
