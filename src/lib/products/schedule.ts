import { isWeekKey, upcomingWeekKeys, weekKeyFor } from "@/lib/weeks";
import type { Tier } from "./input";

/**
 * When a listing debuts. Free debuts wait for a Monday (the first week with a
 * free slot, picked in the service). Paid debuts skip that wait: they go into
 * the current week on approval, so they're live the moment they're approved,
 * unless the maker booked a later week (Pro and up). Pure; no database.
 */

/** How far ahead, after the current week, paid tiers can book. */
export const BOOKABLE_WEEKS = 8;

/** Weeks a paid tier can pick: this week (live on approval) and the next BOOKABLE_WEEKS. */
export function bookableWeeks(now = new Date()): string[] {
  return [weekKeyFor(now), ...upcomingWeekKeys(now, BOOKABLE_WEEKS)];
}

/** The week a paid listing goes into when approved. A booked week that has passed counts as "now". */
export function paidWeek(tier: Exclude<Tier, "free">, requestedWeekKey: string | null, now = new Date()): string {
  const current = weekKeyFor(now);
  if (tier === "fast_track" || !requestedWeekKey || !isWeekKey(requestedWeekKey)) return current;
  return bookableWeeks(now).includes(requestedWeekKey) ? requestedWeekKey : current;
}
