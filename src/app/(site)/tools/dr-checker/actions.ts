"use server";

import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { clientIp } from "@/lib/request";
import { checkDr, ToolError } from "@/lib/tools/service";

export type DrState = { ok: true; result: Awaited<ReturnType<typeof checkDr>> } | { ok: false; error: string } | null;

export async function drAction(_prev: DrState, form: FormData): Promise<DrState> {
  const domain = form.get("domain");
  if (typeof domain !== "string" || !domain.trim() || domain.length > 500)
    return { ok: false, error: "Enter a domain." };
  const [h, user] = await Promise.all([headers(), getCurrentUser().catch(() => null)]);
  try {
    const result = await checkDr(domain, { clientKey: clientIp(h) ?? "unknown", userId: user?.id, source: "web" });
    return { ok: true, result };
  } catch (err) {
    if (err instanceof ToolError) return { ok: false, error: err.message };
    console.error("DR check failed", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
