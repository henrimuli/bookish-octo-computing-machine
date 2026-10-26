import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { notifyAdminPaidTier, notifyPaidTierApplied, notifyProductSubmitted } from "@/lib/notifications";
import { TIERS, tierForSku } from "@/lib/products/input";
import { applyPaidTier } from "@/lib/products/service";
import { registerFulfillment } from "./fulfillment";

/** Paid debut tiers: upgrade the listing named in the order and (re)schedule it. */
registerFulfillment("launch", async (order) => {
  const productId = typeof order.metadata.productId === "string" ? order.metadata.productId : null;
  const weekKey = typeof order.metadata.weekKey === "string" ? order.metadata.weekKey : null;
  const tier = tierForSku(order.sku);
  if (!productId || !tier) throw new Error(`Launch order ${order.id} is missing its product or tier`);

  const before = await db().query.products.findFirst({
    where: eq(schema.products.id, productId),
    columns: { status: true },
  });
  const product = await applyPaidTier(productId, tier, weekKey);
  await notifyPaidTierApplied(product, TIERS[tier].label);
  await notifyAdminPaidTier(product, tier);
  if (before?.status !== "pending" && product.status === "pending") await notifyProductSubmitted(product);
  // Spotlight bundles a Starter submission package, started from this listing.
  if (tier === "spotlight") {
    const { openOrderFromPayment } = await import("@/lib/submissions/service");
    await openOrderFromPayment(order, "starter");
  }
});

/** Submission packages: open the order and send the buyer their private intake link. */
registerFulfillment("submission", async (order) => {
  const { openOrderFromPayment } = await import("@/lib/submissions/service");
  await openOrderFromPayment(order);
});

/** Featured slots: the held booking named in the order becomes active. */
registerFulfillment("featured", async (order) => {
  const bookingId = typeof order.metadata.bookingId === "string" ? order.metadata.bookingId : null;
  if (!bookingId) throw new Error(`Featured order ${order.id} is missing its booking`);
  const { activateBooking } = await import("@/lib/ads/service");
  await activateBooking(bookingId);
});
