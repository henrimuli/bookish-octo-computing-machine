"use server";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { duelPair, type DuelProduct } from "@/lib/board/duels";
import { EngagementError, toggleApplause } from "@/lib/board/engagement";

type Pair = [DuelProduct, DuelProduct] | null;
const ids = z.array(z.string().uuid()).max(200);

/** Next pair to compare. `seen` keeps already-shown products out of this session. */
export async function nextDuelAction(seen: string[]): Promise<Pair> {
  const user = await getCurrentUser();
  const parsed = ids.safeParse(seen);
  return duelPair(user?.id ?? null, parsed.success ? parsed.data : []);
}

/** Picking a winner gives it a normal clap (same weighting and limits as the clap button). */
export async function pickWinnerAction(
  winnerId: string,
): Promise<{ ok: true } | { ok: false; error: string; needsAuth?: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to applaud.", needsAuth: true };
  if (!z.string().uuid().safeParse(winnerId).success) return { ok: false, error: "Unknown product." };

  const already = await db().query.applause.findFirst({
    where: and(eq(schema.applause.productId, winnerId), eq(schema.applause.userId, user.id)),
    columns: { productId: true },
  });
  if (already) return { ok: true };

  const h = await headers();
  try {
    await toggleApplause({
      userId: user.id,
      productId: winnerId,
      ip: h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: h.get("user-agent"),
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof EngagementError) return { ok: false, error: err.message };
    throw err;
  }
}
