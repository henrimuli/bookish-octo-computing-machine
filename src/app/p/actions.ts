"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { addComment, EngagementError, removeComment, toggleVote } from "@/lib/board/engagement";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: string; needsAuth?: boolean };

function clientIp(h: Headers): string | null {
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

export async function toggleVoteAction(productId: string): Promise<Result<{ voted: boolean; votes: number }>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to vote.", needsAuth: true };
  const h = await headers();
  try {
    const data = await toggleVote({ userId: user.id, productId, ip: clientIp(h), userAgent: h.get("user-agent") });
    return { ok: true, data };
  } catch (err) {
    if (err instanceof EngagementError) return { ok: false, error: err.message };
    throw err;
  }
}

export async function addCommentAction(productId: string, body: string, parentId?: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to comment.", needsAuth: true };
  try {
    await addComment({ userId: user.id, productId, body, parentId });
  } catch (err) {
    if (err instanceof EngagementError) return { ok: false, error: err.message };
    throw err;
  }
  refresh();
  return { ok: true, data: undefined };
}

export async function removeCommentAction(commentId: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first.", needsAuth: true };
  try {
    await removeComment(commentId, { id: user.id, staff: isStaff(user) });
  } catch (err) {
    if (err instanceof EngagementError) return { ok: false, error: err.message };
    throw err;
  }
  refresh();
  return { ok: true, data: undefined };
}
