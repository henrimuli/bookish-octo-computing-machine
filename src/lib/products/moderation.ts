import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { notifyProductApproved, notifyProductRejected } from "@/lib/notifications";
import { refundOrder } from "@/lib/payments/service";
import { approveProduct, ProductError, rejectProduct } from "./service";

export async function approve(productId: string) {
  const p = await approveProduct(productId);
  await notifyProductApproved(p);
  return p;
}

/**
 * Rejects a listing. Under the money-back guarantee, every paid launch order
 * for it is refunded in full first; if a refund fails, the listing stays
 * pending so the rejection can be retried.
 */
export async function reject(productId: string, reason: string) {
  const current = await db().query.products.findFirst({ where: eq(schema.products.id, productId) });
  if (!current || current.status !== "pending") throw new ProductError("Only pending listings can be rejected.");

  const paid = await db()
    .select({ id: schema.orders.id })
    .from(schema.productOrders)
    .innerJoin(schema.orders, eq(schema.orders.id, schema.productOrders.orderId))
    .where(
      and(eq(schema.productOrders.productId, productId), inArray(schema.orders.status, ["paid", "partially_refunded"])),
    );
  for (const o of paid) {
    await refundOrder(o.id, `Money-back guarantee: listing not approved (${reason})`);
  }

  const p = await rejectProduct(productId, reason);
  if (paid.length > 0) {
    // Paid tiers no longer apply once refunded.
    await db().update(schema.products).set({ tier: "free" }).where(eq(schema.products.id, productId));
  }
  await notifyProductRejected(p, paid.length > 0);
  if (current.tier === "spotlight") {
    // Its spot is free again.
    const { notifySpotlightWaitlist } = await import("./spotlight");
    await notifySpotlightWaitlist().catch((err) => console.error("spotlight waitlist notify failed", err));
  }
  return p;
}
