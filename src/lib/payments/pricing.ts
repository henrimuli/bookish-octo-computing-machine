import type { OneTimeSku } from "./skus";

export type CouponRule = {
  id: string;
  code: string;
  percentOff: number | null;
  amountOffCents: number | null;
  appliesToSkus: string[];
  maxRedemptions: number | null;
  redeemedCount: number;
  expiresAt: Date | null;
};

export type Quote = {
  listAmountCents: number;
  discountCents: number;
  amountCents: number;
  couponId: string | null;
};

export class CouponError extends Error {}

/** Smallest charge we allow; card fees make anything lower pointless. */
export const MIN_CHARGE_CENTS = 100;

/**
 * Prices a one-time SKU with an optional coupon. Pure, so it can be tested
 * without a database. Coupons only apply to one-time purchases.
 */
export function quote(sku: OneTimeSku, coupon: CouponRule | null, now = new Date()): Quote {
  const list = sku.amountCents;
  if (!coupon) return { listAmountCents: list, discountCents: 0, amountCents: list, couponId: null };

  if (coupon.expiresAt && coupon.expiresAt.getTime() <= now.getTime()) {
    throw new CouponError("This coupon has expired.");
  }
  if (coupon.maxRedemptions !== null && coupon.redeemedCount >= coupon.maxRedemptions) {
    throw new CouponError("This coupon has been fully redeemed.");
  }
  if (coupon.appliesToSkus.length > 0 && !coupon.appliesToSkus.includes(sku.id)) {
    throw new CouponError("This coupon doesn't apply to this purchase.");
  }

  let discount = 0;
  if (coupon.percentOff !== null) {
    if (coupon.percentOff <= 0 || coupon.percentOff > 100) throw new CouponError("Invalid coupon.");
    discount = Math.round((list * coupon.percentOff) / 100);
  } else if (coupon.amountOffCents !== null) {
    if (coupon.amountOffCents <= 0) throw new CouponError("Invalid coupon.");
    discount = coupon.amountOffCents;
  }

  const amount = Math.max(list - discount, MIN_CHARGE_CENTS);
  return { listAmountCents: list, discountCents: list - amount, amountCents: amount, couponId: coupon.id };
}
