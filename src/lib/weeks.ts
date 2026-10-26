/**
 * Launch weeks are ISO weeks in UTC: Monday 00:00 UTC to the next Monday 00:00 UTC,
 * keyed like "2026-W44". Pure functions, no database.
 */

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;

/** Monday 00:00 UTC of the week containing `date`. */
export function weekStart(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  return new Date(d.getTime() - dow * DAY);
}

/** ISO week key for the week containing `date`. */
export function weekKeyFor(date: Date): string {
  const monday = weekStart(date);
  // The ISO year is the year of that week's Thursday.
  const thursday = new Date(monday.getTime() + 3 * DAY);
  const isoYear = thursday.getUTCFullYear();
  const firstThursday = weekStart(new Date(Date.UTC(isoYear, 0, 4)));
  const week = Math.round((monday.getTime() - firstThursday.getTime()) / WEEK) + 1;
  return `${isoYear}-W${String(week).padStart(2, "0")}`;
}

const KEY_RE = /^(\d{4})-W(\d{2})$/;

export function isWeekKey(key: string): boolean {
  const m = KEY_RE.exec(key);
  if (!m) return false;
  const { startsAt } = weekBoundsUnchecked(Number(m[1]), Number(m[2]));
  return weekKeyFor(startsAt) === key;
}

function weekBoundsUnchecked(year: number, week: number) {
  // Week 1 is the week containing January 4th.
  const week1 = weekStart(new Date(Date.UTC(year, 0, 4)));
  const startsAt = new Date(week1.getTime() + (week - 1) * WEEK);
  return { startsAt, endsAt: new Date(startsAt.getTime() + WEEK) };
}

/** Start (inclusive) and end (exclusive) of a week key. Throws on invalid keys. */
export function weekBounds(key: string): { startsAt: Date; endsAt: Date } {
  const m = KEY_RE.exec(key);
  if (!m || !isWeekKey(key)) throw new Error(`Invalid week key: ${key}`);
  return weekBoundsUnchecked(Number(m[1]), Number(m[2]));
}

export function addWeeks(key: string, n: number): string {
  return weekKeyFor(new Date(weekBounds(key).startsAt.getTime() + n * WEEK + DAY));
}

/** The next `count` week keys starting with the week after `from`. */
export function upcomingWeekKeys(from: Date, count: number): string[] {
  const current = weekKeyFor(from);
  return Array.from({ length: count }, (_, i) => addWeeks(current, i + 1));
}

/** "Oct 26 – Nov 1, 2026" for display. */
export function formatWeekRange(key: string): string {
  const { startsAt, endsAt } = weekBounds(key);
  const last = new Date(endsAt.getTime() - DAY);
  const fmt = (d: Date, withYear: boolean) =>
    d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
      ...(withYear ? { year: "numeric" } : {}),
    });
  return `${fmt(startsAt, false)} – ${fmt(last, true)}`;
}

/** "Week 44, 2026". */
export function formatWeekLabel(key: string): string {
  const m = KEY_RE.exec(key);
  return m ? `Week ${Number(m[2])}, ${m[1]}` : key;
}
