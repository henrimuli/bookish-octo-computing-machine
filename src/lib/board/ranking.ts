/**
 * Ranking rules (published on /how-ranking-works).
 *
 * score = Σ applause weights given during the debut week (flagged applause excluded)
 *       + COMMENT_BONUS × distinct non-maker commenters during the week whose
 *         comment has at least MIN_COMMENT_LENGTH characters
 *
 * Ties go to more debut-week applause. Applause after the debut week only adds
 * to all-time applause, and debut-week claps are final once the week closes,
 * so a closed week's ranking never changes. Paid tiers buy placement, never score.
 */
import { weekBounds } from "@/lib/weeks";

export const COMMENT_BONUS = 0.5;
export const MIN_COMMENT_LENGTH = 40;

/** Accounts younger than this applaud at reduced weight. */
export const NEW_ACCOUNT_HOURS = 72;
export const NEW_ACCOUNT_WEIGHT = 0.25;
/** Applause from an IP that has already applauded this many times for the product count at reduced weight. */
export const SAME_IP_LIMIT = 2;
export const SAME_IP_WEIGHT = 0.1;
/** Hard cap on applause per account per hour. */
export const APPLAUSE_PER_HOUR = 60;

export function applauseWeight(args: { accountAgeHours: number; sameIpApplauseOnProduct: number }): {
  weight: number;
  flagReason: string | null;
} {
  let weight = 1;
  const reasons: string[] = [];
  if (args.accountAgeHours < NEW_ACCOUNT_HOURS) {
    weight = Math.min(weight, NEW_ACCOUNT_WEIGHT);
    reasons.push("new account");
  }
  if (args.sameIpApplauseOnProduct >= SAME_IP_LIMIT) {
    weight = Math.min(weight, SAME_IP_WEIGHT);
    reasons.push("shared IP");
  }
  return { weight, flagReason: reasons.length ? reasons.join(", ") : null };
}

/** A clap given during a debut week that has since closed can't be taken back. Pure. */
export function isFinal(clappedAt: Date, weekKey: string, now = new Date()): boolean {
  const { endsAt } = weekBounds(weekKey);
  return now >= endsAt && clappedAt < endsAt;
}

export type Ranked = { id: string; score: number; debutApplause: number; approvedAt: Date | null };

/** Orders products by score, then raw debut-week applause, then who was approved first. */
export function rank<T extends Ranked>(items: T[]): Array<T & { rank: number }> {
  return [...items]
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.debutApplause - a.debutApplause ||
        (a.approvedAt?.getTime() ?? 0) - (b.approvedAt?.getTime() ?? 0) ||
        a.id.localeCompare(b.id),
    )
    .map((item, i) => ({ ...item, rank: i + 1 }));
}
