import { runCron } from "@/lib/cron";
import { notifySpotlightWaitlist } from "@/lib/products/spotlight";

/**
 * Tells the Spotlight waitlist a spot opened. Cheap when nothing changed (one
 * count query), so Supabase Cron calls it every 5 minutes (see the
 * spotlight_waitlist_cron migration); the daily and hourly jobs run it too.
 */
export function GET(request: Request) {
  return runCron(request, "waitlist", [["spotlight waitlist", () => notifySpotlightWaitlist()]]);
}
