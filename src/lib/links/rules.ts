/** Link Monitor rules (PLAN §4.4). Pure, so the schedule and alerting are unit-tested. */

export type Verdict = "dofollow" | "nofollow" | "missing" | "unreachable";

const DAY = 86_400_000;
/** Checked daily for this long after going live, then weekly. */
export const DAILY_DAYS = 14;
/** A link counts as dead after this many failed checks in a row. */
export const DEAD_AFTER = 2;
/** Links checked per cron run, and how many at once. */
export const BATCH_SIZE = 200;
export const CONCURRENCY = 5;

export const failed = (v: Verdict | null) => v === "missing" || v === "unreachable";

/**
 * When to check next: daily for the first two weeks after going live, then
 * weekly. A first failure is re-checked the next day so a blip isn't reported.
 */
export function nextCheckAt(liveAt: Date, now: Date, failures: number): Date {
  const young = now.getTime() - liveAt.getTime() < DAILY_DAYS * DAY;
  const days = young || (failures > 0 && failures < DEAD_AFTER) ? 1 : 7;
  return new Date(now.getTime() + days * DAY);
}

export type Change = "nofollow" | "removed" | "recovered";

/**
 * What changed since the previous check, if it's worth telling the owner.
 * `prevFailures` and `failures` are the consecutive failure counts before and
 * after this check. Missing or unreachable is only reported once confirmed
 * (the DEAD_AFTER-th check in a row), and only once; a recovery is only news
 * if we reported the problem. The first ever check reports nothing.
 */
export function classifyChange(
  prev: Verdict | null,
  next: Verdict,
  prevFailures: number,
  failures: number,
): Change | null {
  if (prev === null) return null;
  if (failed(next)) return failures === DEAD_AFTER ? "removed" : null;
  if (next === "nofollow") return prev === "dofollow" ? "nofollow" : null;
  // next is dofollow
  return prev === "nofollow" || (failed(prev) && prevFailures >= DEAD_AFTER) ? "recovered" : null;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "3 links flipped to nofollow, 1 listing removed, 1 link recovered". */
export function summarizeChanges(changes: Change[]): string {
  const n = (c: Change) => changes.filter((x) => x === c).length;
  return [
    n("nofollow") && `${plural(n("nofollow"), "link", "links")} flipped to nofollow`,
    n("removed") && `${plural(n("removed"), "listing", "listings")} removed or unreachable`,
    n("recovered") && `${plural(n("recovered"), "link", "links")} recovered`,
  ]
    .filter(Boolean)
    .join(", ");
}

/** Normalises what a user types as "your domain" (a domain or a URL) to a bare host. */
export function normalizeDomain(input: string): string | null {
  const raw = input.trim().toLowerCase();
  if (!raw) return null;
  try {
    const host = new URL(/^https?:\/\//.test(raw) ? raw : `https://${raw}`).hostname.replace(/^www\./, "");
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(host) ? host : null;
  } catch {
    return null;
  }
}

/** Runs `fn` over `items` with at most `limit` in flight. */
export async function mapPool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const worker = async () => {
    while (i < items.length) {
      const at = i++;
      out[at] = await fn(items[at]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}
