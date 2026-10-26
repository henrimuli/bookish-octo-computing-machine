import { env } from "@/env";
import { recheckBadges } from "@/lib/badges/service";
import { closeEndedPeriods, closeEndedWeeks } from "@/lib/board/rollover";
import { settleBookings } from "@/lib/ads/service";
import { refreshDirectoryStats } from "@/lib/directories/service";
import { monitorLinks } from "@/lib/links/service";
import { sendOrderDigests } from "@/lib/submissions/service";
import { draftWeeklyRecap } from "@/lib/blog/service";
import { sendWeeklyDigest } from "@/lib/newsletter/service";
import { reconcilePendingOrders } from "@/lib/payments/service";

/**
 * One daily job (Vercel Hobby allows few crons), scheduled just after Monday
 * 00:00 UTC rolls the week. Each task is independent and idempotent.
 */
export async function GET(request: Request) {
  const secret = env().CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const results: Record<string, unknown> = {};
  const tasks: Array<[string, () => Promise<unknown>]> = [
    ["weeks", () => closeEndedWeeks()],
    ["periods", () => closeEndedPeriods()],
    ["newsletter", () => sendWeeklyDigest()],
    ["recap", () => draftWeeklyRecap()],
    ["payments", () => reconcilePendingOrders()],
    ["ads", () => settleBookings()],
    ["submission digests", () => sendOrderDigests()],
    ["directory stats", () => refreshDirectoryStats()],
    ["badges", () => recheckBadges()],
    ["links", () => monitorLinks()],
  ];
  for (const [name, run] of tasks) {
    try {
      results[name] = await run();
    } catch (err) {
      console.error(`cron task ${name} failed`, err);
      results[name] = { error: err instanceof Error ? err.message : String(err) };
    }
  }
  return Response.json(results);
}
