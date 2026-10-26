"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { verifyBadge } from "@/lib/badges/service";

/** Runs a badge check now. Limited to once a minute per listing. */
export async function verifyBadgeAction(productId: string): Promise<{ ok: boolean; status?: string; message: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, message: "Sign in first." };
  const owned = await db().query.products.findFirst({
    where: and(eq(schema.products.id, productId), eq(schema.products.createdBy, user.id)),
    columns: { id: true },
  });
  if (!owned) return { ok: false, message: "Listing not found." };

  const row = await db().query.badgeVerifications.findFirst({
    where: eq(schema.badgeVerifications.productId, productId),
  });
  if (row?.lastCheckedAt && Date.now() - row.lastCheckedAt.getTime() < 60_000) {
    return { ok: false, message: "Checked less than a minute ago. Try again shortly." };
  }

  const result = await verifyBadge(productId);
  refresh();
  return result.status === "verified"
    ? {
        ok: true,
        status: result.status,
        message: `Badge verified via ${result.method === "dns" ? "DNS" : "your site"}.`,
      }
    : { ok: false, status: result.status, message: result.failureReason ?? "Badge not found." };
}
