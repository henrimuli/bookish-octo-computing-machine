import { settleBookings } from "@/lib/ads/service";
import { runCron } from "@/lib/cron";
import { reconcilePendingOrders } from "@/lib/payments/service";
import { notifySpotlightWaitlist } from "@/lib/products/spotlight";

/**
 * Faster catch-up for payments whose webhook never arrived, for ad bookings
 * to settle, and for telling the Spotlight waitlist a spot opened. Supabase
 * Cron calls it at :05 every hour (see the spotlight_waitlist_cron
 * migration), since Vercel Hobby rejects sub-daily crons. Every task is
 * idempotent, so running them from the daily job too is safe.
 */
export function GET(request: Request) {
  return runCron(request, "hourly", [
    ["payments", () => reconcilePendingOrders()],
    ["ads", () => settleBookings()],
    ["spotlight waitlist", () => notifySpotlightWaitlist()],
  ]);
}
