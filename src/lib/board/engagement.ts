import "server-only";
import { and, count, eq, gte } from "drizzle-orm";
import { createHash } from "node:crypto";
import { db, schema } from "@/db";
import { env } from "@/env";
import { weekKeyFor } from "@/lib/weeks";
import { APPLAUSE_PER_HOUR, applauseWeight, isFinal } from "./ranking";

const { applause, comments, products, user } = schema;

export class EngagementError extends Error {}

/** Salted hash so we can spot clusters without storing raw IPs or user agents. */
export function fingerprint(value: string | null): string | null {
  if (!value) return null;
  const salt = env().BETTER_AUTH_SECRET ?? "debutyard";
  return createHash("sha256").update(`${salt}:${value}`).digest("hex").slice(0, 32);
}

async function assertLive(productId: string) {
  const p = await db().query.products.findFirst({
    where: eq(products.id, productId),
    columns: { status: true, launchWeekKey: true, createdBy: true },
  });
  if (!p || p.status !== "approved" || !p.launchWeekKey || p.launchWeekKey > weekKeyFor(new Date())) {
    throw new EngagementError("This product isn't live yet.");
  }
  return p;
}

/**
 * Gives or takes back the user's clap, any time the product is live. Claps
 * during the debut week count toward the competition; later ones only toward
 * all-time applause. Once the week closes, a clap given during it is final, so
 * a closed week's board never changes. Returns whether they now applaud it,
 * and the product's all-time applause.
 */
export async function toggleApplause(args: {
  userId: string;
  productId: string;
  ip: string | null;
  userAgent: string | null;
}): Promise<{ applauded: boolean; applause: number }> {
  const p = await assertLive(args.productId);

  const existing = await db().query.applause.findFirst({
    where: and(eq(applause.productId, args.productId), eq(applause.userId, args.userId)),
  });
  if (existing && isFinal(existing.createdAt, p.launchWeekKey!)) {
    throw new EngagementError("Your applause from its debut week is final now that the week has closed.");
  }
  if (existing) {
    await db()
      .delete(applause)
      .where(and(eq(applause.productId, args.productId), eq(applause.userId, args.userId)));
  } else {
    const hourAgo = new Date(Date.now() - 3600_000);
    const [recent] = await db()
      .select({ n: count() })
      .from(applause)
      .where(and(eq(applause.userId, args.userId), gte(applause.createdAt, hourAgo)));
    if ((recent?.n ?? 0) >= APPLAUSE_PER_HOUR)
      throw new EngagementError("You're applauding very fast. Take a short break.");

    const applauder = await db().query.user.findFirst({
      where: eq(user.id, args.userId),
      columns: { createdAt: true },
    });
    const ipHash = fingerprint(args.ip);
    const [sameIp] = ipHash
      ? await db()
          .select({ n: count() })
          .from(applause)
          .where(and(eq(applause.productId, args.productId), eq(applause.ipHash, ipHash)))
      : [{ n: 0 }];
    const { weight, flagReason } = applauseWeight({
      accountAgeHours: applauder ? (Date.now() - applauder.createdAt.getTime()) / 3600_000 : 0,
      sameIpApplauseOnProduct: sameIp?.n ?? 0,
    });
    await db()
      .insert(applause)
      .values({
        productId: args.productId,
        userId: args.userId,
        weight,
        flagReason,
        ipHash,
        uaHash: fingerprint(args.userAgent),
      })
      .onConflictDoNothing();
  }

  const [total] = await db().select({ n: count() }).from(applause).where(eq(applause.productId, args.productId));
  return { applauded: !existing, applause: total?.n ?? 0 };
}

export const MAX_COMMENT_LENGTH = 2000;

export async function addComment(args: { userId: string; productId: string; body: string; parentId?: string | null }) {
  await assertLive(args.productId);
  const body = args.body.trim();
  if (body.length < 2) throw new EngagementError("Write a bit more.");
  if (body.length > MAX_COMMENT_LENGTH) throw new EngagementError(`Keep it under ${MAX_COMMENT_LENGTH} characters.`);

  const tenMinAgo = new Date(Date.now() - 600_000);
  const [recent] = await db()
    .select({ n: count() })
    .from(comments)
    .where(and(eq(comments.userId, args.userId), gte(comments.createdAt, tenMinAgo)));
  if ((recent?.n ?? 0) >= 10) throw new EngagementError("Slow down a little before commenting again.");

  let parentId: string | null = null;
  if (args.parentId) {
    const parent = await db().query.comments.findFirst({
      where: and(eq(comments.id, args.parentId), eq(comments.productId, args.productId)),
      columns: { id: true, parentId: true },
    });
    if (!parent) throw new EngagementError("That comment no longer exists.");
    parentId = parent.parentId ?? parent.id; // one level of threading
  }

  const [comment] = await db()
    .insert(comments)
    .values({ productId: args.productId, userId: args.userId, body, parentId })
    .returning();
  return comment;
}

/** Authors delete their own comments; staff can hide any. */
export async function removeComment(commentId: string, actor: { id: string; staff: boolean }) {
  const c = await db().query.comments.findFirst({ where: eq(comments.id, commentId) });
  if (!c) return;
  if (c.userId !== actor.id && !actor.staff) throw new EngagementError("Not your comment.");
  await db()
    .update(comments)
    .set({ status: c.userId === actor.id ? "deleted" : "hidden" })
    .where(eq(comments.id, commentId));
}
