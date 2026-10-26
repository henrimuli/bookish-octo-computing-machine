/**
 * Ranking rules (published on /how-ranking-works).
 *
 * score = Σ vote weights cast during the debut week (flagged votes excluded)
 *       + COMMENT_BONUS × distinct non-maker commenters during the week whose
 *         comment has at least MIN_COMMENT_LENGTH characters
 *
 * Paid tiers buy placement, never score.
 */
export const COMMENT_BONUS = 0.5;
export const MIN_COMMENT_LENGTH = 40;

/** Accounts younger than this vote at reduced weight. */
export const NEW_ACCOUNT_HOURS = 72;
export const NEW_ACCOUNT_WEIGHT = 0.25;
/** Votes from an IP that has already voted this many times for the product count at reduced weight. */
export const SAME_IP_LIMIT = 2;
export const SAME_IP_WEIGHT = 0.1;
/** Hard cap on votes per account per hour. */
export const VOTES_PER_HOUR = 60;

export function voteWeight(args: { accountAgeHours: number; sameIpVotesOnProduct: number }): {
  weight: number;
  flagReason: string | null;
} {
  let weight = 1;
  const reasons: string[] = [];
  if (args.accountAgeHours < NEW_ACCOUNT_HOURS) {
    weight = Math.min(weight, NEW_ACCOUNT_WEIGHT);
    reasons.push("new account");
  }
  if (args.sameIpVotesOnProduct >= SAME_IP_LIMIT) {
    weight = Math.min(weight, SAME_IP_WEIGHT);
    reasons.push("shared IP");
  }
  return { weight, flagReason: reasons.length ? reasons.join(", ") : null };
}

export type Ranked = { id: string; score: number; votes: number; approvedAt: Date | null };

/** Orders products by score, then raw votes, then who was approved first. */
export function rank<T extends Ranked>(items: T[]): Array<T & { rank: number }> {
  return [...items]
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.votes - a.votes ||
        (a.approvedAt?.getTime() ?? 0) - (b.approvedAt?.getTime() ?? 0) ||
        a.id.localeCompare(b.id),
    )
    .map((item, i) => ({ ...item, rank: i + 1 }));
}
