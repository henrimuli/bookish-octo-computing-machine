import { settleBookings } from "@/lib/ads/service";
import { runCron } from "@/lib/cron";
import { reconcilePendingOrders } from "@/lib/payments/service";
import { notifySpotlightWaitlist } from "@/lib/products/spotlight";

/**
 * Faster catch-up for payments whose webhook never arrived and for ad
 * bookings to settle, and for telling the Spotlight waitlist a spot opened. Not in vercel.json: Vercel Hobby rejects sub-daily
 * crons, so the daily job covers these until the project is on Pro. To turn
 * it on, add `{ "path": "/api/cron/hourly", "schedule": "5 * * * *" }` to
 * vercel.json's crons. Both tasks are idempotent, so running them from both
 * jobs is safe.
 */
export function GET(request: Request) {
  return runCron(request, "hourly", [
    ["payments", () => reconcilePendingOrders()],
    ["ads", () => settleBookings()],
    ["spotlight waitlist", () => notifySpotlightWaitlist()],
  ]);
}
