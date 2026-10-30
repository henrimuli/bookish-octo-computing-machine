"use server";

import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { confirmSubscription, subscribe, subscribeVerified, unsubscribe } from "@/lib/newsletter/service";

export type SubscribeState = { ok: boolean; message: string } | null;

const input = z.object({
  email: z.string().trim().email().max(254),
  source: z.string().max(40).optional(),
  // Honeypot: real people never see or fill it.
  website: z.string().max(0).optional(),
});

export async function subscribeAction(_prev: SubscribeState, form: FormData): Promise<SubscribeState> {
  const parsed = input.safeParse({
    email: form.get("email"),
    source: form.get("source") || undefined,
    website: form.get("website") || undefined,
  });
  if (!parsed.success) return { ok: false, message: "Enter a valid email address." };

  const result = await subscribe(parsed.data.email, parsed.data.source ?? null);
  if (result === "already_subscribed") return { ok: true, message: "You're already subscribed. See you Monday!" };
  return { ok: true, message: "Check your inbox and click the link to confirm." };
}

/** The "send me the weekly digest" switch on the sign-in form: runs once sign-in has finished. */
export async function subscribeSignedInAction(): Promise<boolean> {
  const user = await getCurrentUser();
  if (!user?.email) return false;
  await subscribeVerified(user.email, "sign-in");
  return true;
}

export async function unsubscribeAction(_prev: boolean | null, form: FormData): Promise<boolean> {
  const token = form.get("token");
  if (typeof token !== "string" || token.length > 64) return false;
  return unsubscribe(token);
}

export async function confirmAction(_prev: boolean | null, form: FormData): Promise<boolean> {
  const token = form.get("token");
  if (typeof token !== "string" || token.length > 64) return false;
  return confirmSubscription(token);
}
