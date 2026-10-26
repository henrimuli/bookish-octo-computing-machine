"use server";

import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { checkReadiness, ReadinessError, type ReadinessReport } from "@/lib/readiness/service";
import { clientIp } from "@/lib/request";

export type ReadinessState = { ok: true; report: ReadinessReport } | { ok: false; error: string } | null;

export async function readinessAction(_prev: ReadinessState, form: FormData): Promise<ReadinessState> {
  const url = form.get("url");
  if (typeof url !== "string" || !url.trim() || url.length > 500) return { ok: false, error: "Enter a URL." };
  const [h, user] = await Promise.all([headers(), getCurrentUser().catch(() => null)]);
  try {
    const report = await checkReadiness(url, { clientKey: clientIp(h) ?? "unknown", userId: user?.id, source: "web" });
    return { ok: true, report };
  } catch (err) {
    if (err instanceof ReadinessError) return { ok: false, error: err.message };
    console.error("readiness check failed", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}
