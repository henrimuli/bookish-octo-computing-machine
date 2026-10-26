"use server";

import { and, eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { safeFetchText, UnsafeUrlError } from "@/lib/net";
import { enabledProviders } from "@/lib/payments";
import { CouponError } from "@/lib/payments/pricing";
import { CheckoutError, startCheckout } from "@/lib/payments/service";
import type { ProviderId } from "@/lib/payments/types";
import { notifyProductSubmitted } from "@/lib/notifications";
import { productInput, TIERS, tierRank, type ProductInput, type Tier } from "@/lib/products/input";
import { extractPrefill, type Prefill } from "@/lib/products/prefill";
import {
  bookableWeeks,
  ProductError,
  saveProduct,
  spotlightsBooked,
  SPOTLIGHTS_PER_WEEK,
  submitForReview,
} from "@/lib/products/service";
import { createUploadUrl, MAX_UPLOAD_BYTES } from "@/lib/storage";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string> };

/** Fetches the maker's site and suggests listing details. */
export async function prefillAction(url: string): Promise<Result<Prefill>> {
  if (!(await getCurrentUser())) return { ok: false, error: "Sign in first." };
  const normalized = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
  try {
    const page = await safeFetchText(normalized, { timeoutMs: 8000 });
    if (page.status >= 400) return { ok: false, error: `Your site returned HTTP ${page.status}.` };
    return { ok: true, data: extractPrefill(page.body, page.url) };
  } catch (err) {
    if (err instanceof UnsafeUrlError) return { ok: false, error: err.message };
    return { ok: false, error: "We couldn't reach that site. You can fill the details in by hand." };
  }
}

/** Creates or updates a listing, then sends the maker to the plan step. */
export async function saveProductAction(input: ProductInput, productId?: string): Promise<Result<{ id: string }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first." };

  const parsed = productInput.safeParse(input);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors };
  }
  try {
    const product = await saveProduct(user.id, parsed.data, productId);
    return { ok: true, data: { id: product.id } };
  } catch (err) {
    if (err instanceof ProductError) return { ok: false, error: err.message };
    throw err;
  }
}

/** Presigned upload for a listing logo (R2). */
export async function logoUploadAction(
  contentType: string,
  size: number,
): Promise<Result<{ uploadUrl: string; publicUrl: string }>> {
  if (!(await getCurrentUser())) return { ok: false, error: "Sign in first." };
  if (size > MAX_UPLOAD_BYTES) return { ok: false, error: "Logos must be under 5 MB." };
  try {
    const { uploadUrl, publicUrl } = await createUploadUrl({ folder: "logos", contentType, contentLength: size });
    return { ok: true, data: { uploadUrl, publicUrl } };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Upload failed" };
  }
}

/** Free debut: straight into the review queue. */
export async function submitFreeAction(productId: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first." };
  try {
    const p = await submitForReview(productId, user.id);
    if (p.status === "pending") await notifyProductSubmitted(p);
  } catch (err) {
    if (err instanceof ProductError) return { ok: false, error: err.message };
    throw err;
  }
  redirect(`/dashboard?submitted=${productId}`);
}

/** Paid debut: creates the order and returns the provider's checkout URL. */
export async function startTierCheckoutAction(args: {
  productId: string;
  tier: Exclude<Tier, "free">;
  provider: ProviderId;
  weekKey?: string;
  coupon?: string;
}): Promise<Result<{ url: string }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first." };

  const tier = TIERS[args.tier];
  if (!tier?.sku) return { ok: false, error: "Unknown plan." };
  if (!enabledProviders().includes(args.provider)) return { ok: false, error: "That payment method isn't available." };

  const product = await db().query.products.findFirst({
    where: and(eq(schema.products.id, args.productId), eq(schema.products.createdBy, user.id)),
  });
  if (!product) return { ok: false, error: "Listing not found." };
  if (product.status === "archived") return { ok: false, error: "This listing is archived." };
  if (tierRank(args.tier) <= tierRank(product.tier))
    return { ok: false, error: `This listing already has ${TIERS[product.tier].label}.` };

  let weekKey: string | undefined;
  if (tier.picksWeek) {
    if (!args.weekKey || !bookableWeeks().includes(args.weekKey)) return { ok: false, error: "Pick a debut week." };
    weekKey = args.weekKey;
  }
  if (args.tier === "spotlight" && (await spotlightsBooked(weekKey!, product.id)) >= SPOTLIGHTS_PER_WEEK) {
    return { ok: false, error: "Spotlight is sold out for that week. Pick another week." };
  }

  try {
    const { orderId, url } = await startCheckout({
      skuId: tier.sku,
      provider: args.provider,
      email: user.email,
      userId: user.id,
      couponCode: args.coupon || null,
      metadata: { productId: product.id, weekKey: weekKey ?? null },
    });
    await db().insert(schema.productOrders).values({ orderId, productId: product.id });
    return { ok: true, data: { url } };
  } catch (err) {
    if (err instanceof CouponError || err instanceof CheckoutError) return { ok: false, error: err.message };
    console.error("tier checkout failed", err);
    return { ok: false, error: "Couldn't start checkout. Please try again." };
  }
}
