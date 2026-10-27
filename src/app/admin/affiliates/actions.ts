"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AffiliateError, approveReferral, markAffiliatePaid, setAffiliateStatus } from "@/lib/affiliates/service";
import { getCurrentUser, isStaff } from "@/lib/auth";

type Result = { ok: true; message?: string } | { ok: false; error: string };
const id = z.string().uuid();

async function staff() {
  const user = await getCurrentUser();
  return !!user && (await isStaff(user));
}

export async function approveReferralAction(referralId: string): Promise<Result> {
  if (!(await staff()) || !id.safeParse(referralId).success) return { ok: false, error: "Not allowed." };
  try {
    await approveReferral(referralId);
  } catch (err) {
    if (err instanceof AffiliateError) return { ok: false, error: err.message };
    throw err;
  }
  revalidatePath("/admin/affiliates");
  return { ok: true };
}

export async function markPaidAction(affiliateId: string): Promise<Result> {
  if (!(await staff()) || !id.safeParse(affiliateId).success) return { ok: false, error: "Not allowed." };
  const { count, cents } = await markAffiliatePaid(affiliateId);
  revalidatePath("/admin/affiliates");
  return { ok: true, message: `Marked ${count} commissions ($${(cents / 100).toFixed(2)}) paid.` };
}

export async function setStatusAction(affiliateId: string, status: "active" | "suspended"): Promise<Result> {
  if (!(await staff()) || !id.safeParse(affiliateId).success || !["active", "suspended"].includes(status)) {
    return { ok: false, error: "Not allowed." };
  }
  await setAffiliateStatus(affiliateId, status);
  revalidatePath("/admin/affiliates");
  return { ok: true };
}
