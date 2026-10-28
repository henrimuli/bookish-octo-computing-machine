"use server";

import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { clientIp } from "@/lib/request";
import { checkDofollow, ToolError } from "@/lib/tools/service";

export type DofollowState =
  { ok: true; result: Awaited<ReturnType<typeof checkDofollow>> } | { ok: false; error: string } | null;

export async function dofollowAction(_prev: DofollowState, form: FormData): Promise<DofollowState> {
  const pageUrl = form.get("pageUrl");
  const target = form.get("target");
  if (typeof pageUrl !== "string" || typeof target !== "string" || !pageUrl.trim() || !target.trim()) {
    return { ok: false, error: "Enter both the page and your site." };
  }
  if (pageUrl.length > 500 || target.length > 500) return { ok: false, error: "That URL is too long." };
  const [h, user] = await Promise.all([headers(), getCurrentUser().catch(() => null)]);
  try {
    const result = await checkDofollow(pageUrl, target, {
      clientKey: clientIp(h) ?? "unknown",
      userId: user?.id,
      source: "web",
    });
    return { ok: true, result };
  } catch (err) {
    if (err instanceof ToolError) return { ok: false, error: err.message };
    console.error("dofollow check failed", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
