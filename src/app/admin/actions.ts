"use server";

import { refresh } from "next/cache";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { approve, reject } from "@/lib/products/moderation";
import { ProductError } from "@/lib/products/service";

type Result = { ok: true } | { ok: false; error: string };

async function staffOnly() {
  const user = await getCurrentUser();
  return user && (await isStaff(user)) ? user : null;
}

export async function approveAction(productId: string): Promise<Result> {
  if (!(await staffOnly())) return { ok: false, error: "Not allowed." };
  try {
    await approve(productId);
  } catch (err) {
    if (err instanceof ProductError) return { ok: false, error: err.message };
    throw err;
  }
  refresh();
  return { ok: true };
}

export async function rejectAction(productId: string, reason: string): Promise<Result> {
  if (!(await staffOnly())) return { ok: false, error: "Not allowed." };
  const trimmed = reason.trim();
  if (trimmed.length < 5) return { ok: false, error: "Give the maker a reason." };
  try {
    await reject(productId, trimmed.slice(0, 500));
  } catch (err) {
    if (err instanceof ProductError) return { ok: false, error: err.message };
    console.error("reject failed", err);
    return { ok: false, error: err instanceof Error ? err.message : "Reject failed" };
  }
  refresh();
  return { ok: true };
}
