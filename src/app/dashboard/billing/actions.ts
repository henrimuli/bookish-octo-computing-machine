"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { BillingError, setFeaturedListing } from "@/lib/billing/service";
import { cancelSubscription } from "@/lib/payments/service";

type Result = { ok: true } | { ok: false; error: string };
const id = z.string().uuid();

export async function cancelSubscriptionAction(subscriptionId: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!user || !id.safeParse(subscriptionId).success) return { ok: false, error: "Not found." };
  try {
    await cancelSubscription(subscriptionId, user.id);
  } catch (err) {
    console.error("cancel subscription failed", err);
    return { ok: false, error: "We couldn't cancel with the payment provider. Please try again, or email us." };
  }
  revalidatePath("/dashboard/billing");
  return { ok: true };
}

export async function setFeaturedListingAction(subscriptionId: string, productId: string | null): Promise<Result> {
  const user = await getCurrentUser();
  if (!user || !id.safeParse(subscriptionId).success || (productId && !id.safeParse(productId).success)) {
    return { ok: false, error: "Not found." };
  }
  try {
    await setFeaturedListing(user.id, subscriptionId, productId);
  } catch (err) {
    if (err instanceof BillingError) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath("/dashboard/billing");
  return { ok: true };
}
