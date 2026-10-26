import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { enabledProviders } from "@/lib/payments";
import { CouponError } from "@/lib/payments/pricing";
import { CheckoutError, startCheckout, startSubscription } from "@/lib/payments/service";
import { getSku, isPurchasable } from "@/lib/payments/skus";

const body = z.object({
  sku: z.string().min(1),
  provider: z.enum(["paystack", "paypal"]),
  email: z.string().email().optional(),
  coupon: z.string().max(64).optional(),
});

/** Starts a checkout and returns the provider URL to redirect to. */
export async function POST(request: Request) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request" }, { status: 400 });
  const input = parsed.data;

  if (!enabledProviders().includes(input.provider)) {
    return Response.json({ error: "That payment method isn't available yet." }, { status: 400 });
  }

  const sku = getSku(input.sku);
  if (!sku) return Response.json({ error: "Unknown product" }, { status: 404 });
  if (!isPurchasable(sku)) return Response.json({ error: "This isn't available to buy yet." }, { status: 400 });

  const user = await getCurrentUser();
  const email = user?.email ?? input.email;

  try {
    if (sku.type === "recurring") {
      if (!user) return Response.json({ error: "Sign in to subscribe." }, { status: 401 });
      const { url } = await startSubscription({
        skuId: sku.id,
        provider: input.provider,
        userId: user.id,
        email: user.email,
      });
      return Response.json({ url });
    }
    // One-time purchases (e.g. the submission service) don't need an account.
    if (!email) return Response.json({ error: "Email is required." }, { status: 400 });
    const { url } = await startCheckout({
      skuId: sku.id,
      provider: input.provider,
      email,
      userId: user?.id,
      couponCode: input.coupon || null,
    });
    return Response.json({ url });
  } catch (err) {
    if (err instanceof CouponError || err instanceof CheckoutError) {
      return Response.json({ error: err.message }, { status: 400 });
    }
    console.error("checkout failed", err);
    return Response.json({ error: "Couldn't start checkout. Please try again." }, { status: 502 });
  }
}
