"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { startLaunchDraft } from "@/lib/blog/service";
import { PerkError, setBlurb, skipPerk } from "@/lib/perks/service";
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

const uuid = z.string().uuid();

/** Runs a perk task change for staff, turning expected failures into a message. */
async function perkAction(taskId: string, fn: () => Promise<unknown>): Promise<Result> {
  if (!(await staffOnly())) return { ok: false, error: "Not allowed." };
  if (!uuid.safeParse(taskId).success) return { ok: false, error: "Not found." };
  try {
    await fn();
  } catch (err) {
    if (err instanceof PerkError) return { ok: false, error: err.message };
    throw err;
  }
  refresh();
  return { ok: true };
}

export async function setBlurbAction(taskId: string, blurb: string): Promise<Result> {
  return perkAction(taskId, () => setBlurb(taskId, blurb));
}

export async function skipPerkAction(taskId: string, reason: string): Promise<Result> {
  return perkAction(taskId, () => skipPerk(taskId, reason));
}

export async function startLaunchDraftAction(
  taskId: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const user = await staffOnly();
  if (!user) return { ok: false, error: "Not allowed." };
  if (!uuid.safeParse(taskId).success) return { ok: false, error: "Not found." };
  try {
    const post = await startLaunchDraft(taskId, user.id);
    refresh();
    return { ok: true, id: post.id };
  } catch (err) {
    if (err instanceof PerkError) return { ok: false, error: err.message };
    throw err;
  }
}
