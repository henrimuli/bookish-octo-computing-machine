"use server";

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { AffiliateError, joinAffiliate, updatePayoutEmail } from "@/lib/affiliates/service";
import { getCurrentUser } from "@/lib/auth";

type Result = { ok: true } | { ok: false; error: string };

function fail(err: unknown): Result {
  if (err instanceof ZodError) return { ok: false, error: err.issues[0]?.message ?? "Check the form." };
  if (err instanceof AffiliateError) return { ok: false, error: err.message };
  throw err;
}

export async function joinAffiliateAction(payoutEmail: string, acceptTerms: boolean): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first." };
  try {
    await joinAffiliate(user.id, { payoutEmail, acceptTerms: acceptTerms as true });
  } catch (err) {
    return fail(err);
  }
  revalidatePath("/dashboard/affiliate");
  return { ok: true };
}

export async function updatePayoutEmailAction(payoutEmail: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first." };
  try {
    await updatePayoutEmail(user.id, payoutEmail);
  } catch (err) {
    if (err instanceof ZodError) return { ok: false, error: "That doesn't look like an email address." };
    throw err;
  }
  revalidatePath("/dashboard/affiliate");
  return { ok: true };
}
