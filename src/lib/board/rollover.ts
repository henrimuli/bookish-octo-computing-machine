import "server-only";
import { and, eq, inArray, isNull, lte } from "drizzle-orm";
import { db, schema } from "@/db";
import { notifyWinner } from "@/lib/notifications";
import { weekBoard } from "./queries";

const { launchWeeks, awards, products } = schema;

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
    const top = board.filter((b) => b.votes > 0).slice(0, WINNER_PLACES);

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
