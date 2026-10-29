import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db, queryRows, schema } from "@/db";
import { FEATURED_DAYS } from "@/lib/board/featured";

/** Spotlight spots on the homepage, across all weeks: never more than this many at once. */
export const SPOTLIGHT_SPOTS = 3;

/** How long a Spotlight holds its spot, from the moment it goes live. */
export const SPOTLIGHT_DAYS = FEATURED_DAYS.spotlight;

/** An unpaid Spotlight checkout holds a spot this long, so two buyers can't pay for the last one. */
const CHECKOUT_HOLD_MINUTES = 30;

/**
 * Spots taken right now: Spotlights waiting for review, approved ones still
 * inside their 30 days (or not started yet), and Spotlight checkouts started
 * in the last half hour. `exceptId` leaves out the listing being bought for.
 */
export async function spotlightSpotsTaken(exceptId: string | null = null, now = new Date()): Promise<number> {
  const [row] = await queryRows<{ n: number }>(sql`
    select count(distinct id)::int as n from (
      select p.id::text as id
      from products p
      left join launch_weeks lw on lw.key = p.launch_week_key
      where p.tier = 'spotlight'
        and (p.status = 'pending'
          or (p.status = 'approved' and (lw.starts_at is null
            or greatest(lw.starts_at, coalesce(p.approved_at, lw.starts_at))
               + make_interval(days => ${SPOTLIGHT_DAYS}) > ${now})))
      union
      select o.metadata->>'productId'
      from orders o
      where o.kind = 'launch' and o.sku = 'launch_spotlight' and o.status = 'pending'
        and o.created_at > ${now}::timestamptz - make_interval(mins => ${CHECKOUT_HOLD_MINUTES})
    ) taken
    where id is not null and id is distinct from ${exceptId}
  `);
  return Number(row?.n ?? 0);
}

export async function spotlightAvailable(exceptId: string | null = null, now = new Date()): Promise<boolean> {
  return (await spotlightSpotsTaken(exceptId, now)) < SPOTLIGHT_SPOTS;
}

/** Is the user waiting for a Spotlight spot (and not yet emailed about one)? */
export async function onSpotlightWaitlist(userId: string): Promise<boolean> {
  const row = await db().query.spotlightWaitlist.findFirst({
    where: and(eq(schema.spotlightWaitlist.userId, userId), isNull(schema.spotlightWaitlist.notifiedAt)),
    columns: { id: true },
  });
  return Boolean(row);
}

/** Puts the user on the waitlist (once; joining again while waiting is a no-op). */
export async function joinSpotlightWaitlist(userId: string, productId: string | null) {
  await db().insert(schema.spotlightWaitlist).values({ userId, productId }).onConflictDoNothing();
}

/**
 * When a spot is free, emails everyone waiting that it opened (first to book
 * gets it) and marks them notified. Run from the crons and after a Spotlight
 * is rejected. Returns how many were emailed.
 */
export async function notifySpotlightWaitlist(now = new Date()): Promise<number> {
  if (!(await spotlightAvailable(null, now))) return 0;
  const waiting = await db()
    .select({
      id: schema.spotlightWaitlist.id,
      productId: schema.spotlightWaitlist.productId,
      email: schema.user.email,
    })
    .from(schema.spotlightWaitlist)
    .innerJoin(schema.user, eq(schema.user.id, schema.spotlightWaitlist.userId))
    .where(isNull(schema.spotlightWaitlist.notifiedAt));
  const { notifySpotlightOpen } = await import("@/lib/notifications");
  let sent = 0;
  for (const w of waiting) {
    // Claim the row first, so overlapping cron runs don't email twice.
    const [claimed] = await db()
      .update(schema.spotlightWaitlist)
      .set({ notifiedAt: now })
      .where(and(eq(schema.spotlightWaitlist.id, w.id), isNull(schema.spotlightWaitlist.notifiedAt)))
      .returning({ id: schema.spotlightWaitlist.id });
    if (!claimed) continue;
    await notifySpotlightOpen(w.email, w.productId);
    sent++;
  }
  return sent;
}
