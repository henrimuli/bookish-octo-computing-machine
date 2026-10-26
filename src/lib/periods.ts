import { addWeeks, weekBounds, weekKeyFor } from "./weeks";

/**
 * Month and year boards group debut weeks by the date of the week's Monday
 * (UTC). A week that starts on Mon Mar 30 belongs to March, even though it
 * ends in April. Pure functions.
 */

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
const YEAR_RE = /^\d{4}$/;

export const isMonthKey = (key: string) => MONTH_RE.test(key);
export const isYearKey = (key: string) => YEAR_RE.test(key);

/** "2026-10" for a week whose Monday is in October 2026. */
export function monthKeyOfWeek(weekKey: string): string {
  return weekBounds(weekKey).startsAt.toISOString().slice(0, 7);
}

export function yearKeyOfWeek(weekKey: string): string {
  return weekBounds(weekKey).startsAt.toISOString().slice(0, 4);
}

/** Every week whose Monday falls in the month (or year) `key`, in order. */
export function weeksInPeriod(key: string): string[] {
  const year = Number(key.slice(0, 4));
  const month = isMonthKey(key) ? Number(key.slice(5, 7)) - 1 : null;
  const from = new Date(Date.UTC(year, month ?? 0, 1));
  const to = new Date(Date.UTC(month === null ? year + 1 : year, month === null ? 0 : month + 1, 1));
  const weeks: string[] = [];
  let k = weekKeyFor(from);
  if (weekBounds(k).startsAt < from) k = addWeeks(k, 1);
  while (weekBounds(k).startsAt < to) {
    weeks.push(k);
    k = addWeeks(k, 1);
  }
  return weeks;
}

/** A period has ended once its last debut week has ended. */
export function periodEnded(key: string, now = new Date()): boolean {
  const weeks = weeksInPeriod(key);
  return weeks.length > 0 && weekBounds(weeks.at(-1)!).endsAt.getTime() <= now.getTime();
}

export function formatMonthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatPeriodLabel(scope: "week" | "month" | "year", key: string): string {
  if (scope === "month") return formatMonthLabel(key);
  if (scope === "year") return key;
  const m = /^(\d{4})-W(\d{2})$/.exec(key);
  return m ? `Week ${Number(m[2])}, ${m[1]}` : key;
}
