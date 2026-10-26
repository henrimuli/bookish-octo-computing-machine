import { env } from "@/env";
import { recheckBadges } from "@/lib/badges/service";
import { closeEndedWeeks } from "@/lib/board/rollover";
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
    ["payments", () => reconcilePendingOrders()],
    ["badges", () => recheckBadges()],
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
