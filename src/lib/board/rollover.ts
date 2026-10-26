import "server-only";
import { and, eq, inArray, isNull, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import { notifyPeriodWinner, notifyWinner } from "@/lib/notifications";
import { monthKeyOfWeek, periodEnded, weeksInPeriod, yearKeyOfWeek } from "@/lib/periods";
import { boardForWeeks, weekBoard } from "./queries";

const { launchWeeks, awards, products, closedPeriods } = schema;

/** Places awarded each week. A product needs at least one vote to place. */
export const WINNER_PLACES = 3;

/**
 * Closes every week that has ended: freezes the top 3 as awards, gives winners
 * a permanent followed link, and emails them. Safe to run repeatedly.
 */
export async function closeEndedWeeks(now = new Date()) {
  const ended = await db()
    .select({ key: launchWeeks.key })
    .from(launchWeeks)
    .where(and(lte(launchWeeks.endsAt, now), isNull(launchWeeks.closedAt)))
    .orderBy(launchWeeks.key);

  const closed: Array<{ week: string; winners: string[] }> = [];
  for (const { key } of ended) {
    const board = await weekBoard(key);
    const top = board.filter((b) => b.score > 0).slice(0, WINNER_PLACES);

    const inserted = top.length
      ? await db()
          .insert(awards)
          .values(
            top.map((b, i) => ({
              productId: b.id,
              scope: "week" as const,
              periodKey: key,
              place: i + 1,
              score: b.score,
            })),
          )
          .onConflictDoNothing()
          .returning()
      : [];

    if (top.length) {
      await db()
        .update(products)
        .set({ isWinner: true })
        .where(
          inArray(
            products.id,
            top.map((b) => b.id),
          ),
        );
    }
    await db().update(launchWeeks).set({ closedAt: now }).where(eq(launchWeeks.key, key));

    for (const award of inserted) {
      const p = await db().query.products.findFirst({ where: eq(products.id, award.productId) });
      if (p) {
        await notifyWinner(p, award.place, key).catch((err) => console.error("winner email failed", err));
      }
    }
    closed.push({ week: key, winners: top.map((b) => b.slug) });
  }
  return closed;
}

/**
 * Closes months and years whose debut weeks have all ended: the top 3 by
 * debut-week score get a month/year award. Runs after the weekly close; each
 * period is closed once (tracked in closed_periods).
 */
export async function closeEndedPeriods(now = new Date()) {
  const weeks = await db().select({ key: launchWeeks.key }).from(launchWeeks).where(lte(launchWeeks.endsAt, now));
  const candidates: Array<{ scope: "month" | "year"; key: string }> = [];
  for (const scope of ["month", "year"] as const) {
    const keys = new Set(weeks.map((w) => (scope === "month" ? monthKeyOfWeek(w.key) : yearKeyOfWeek(w.key))));
    for (const key of keys) if (periodEnded(key, now)) candidates.push({ scope, key });
  }
  if (candidates.length === 0) return [];

  const done = await db().select().from(closedPeriods);
  const isDone = (c: { scope: string; key: string }) => done.some((d) => d.scope === c.scope && d.key === c.key);

  const closed: Array<{ scope: "month" | "year"; key: string; winners: string[] }> = [];
  for (const period of candidates.filter((c) => !isDone(c))) {
    // Claim the period first so concurrent runs can't both award it.
    const [claimed] = await db()
      .insert(closedPeriods)
      .values({ scope: period.scope, key: period.key, closedAt: now })
      .onConflictDoNothing()
      .returning();
    if (!claimed) continue;

    const board = await boardForWeeks(weeksInPeriod(period.key));
    const top = board.filter((b) => b.score > 0).slice(0, WINNER_PLACES);
    const inserted = top.length
      ? await db()
          .insert(awards)
          .values(
            top.map((b, i) => ({
              productId: b.id,
              scope: period.scope,
              periodKey: period.key,
              place: i + 1,
              score: b.score,
            })),
          )
          .onConflictDoNothing()
          .returning()
      : [];

    for (const award of inserted) {
      const p = await db().query.products.findFirst({ where: eq(products.id, award.productId) });
      if (p) {
        await notifyPeriodWinner(p, award.place, period.scope, period.key).catch((err) =>
          console.error("period winner email failed", err),
        );
      }
    }
    closed.push({ ...period, winners: top.map((b) => b.slug) });
  }
  return closed;
}
