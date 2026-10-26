/**
 * Single source of truth for everything DebutYard sells (PLAN.md §5).
 * Amounts are USD cents. Both Paystack and PayPal read prices from here.
 */

export type OneTimeKind = "launch" | "relaunch" | "featured" | "submission";
export type Interval = "monthly" | "annually";

type BaseSku = {
  id: string;
  name: string;
  description: string;
  amountCents: number;
};

export type OneTimeSku = BaseSku & { type: "one_time"; kind: OneTimeKind };
export type RecurringSku = BaseSku & { type: "recurring"; interval: Interval };
export type Sku = OneTimeSku | RecurringSku;

const oneTime = (
  kind: OneTimeKind,
  id: string,
  name: string,
  amountCents: number,
  description: string,
): OneTimeSku => ({
  type: "one_time",
  kind,
  id,
  name,
  amountCents,
  description,
});

const recurring = (
  id: string,
  name: string,
  amountCents: number,
  interval: Interval,
  description: string,
): RecurringSku => ({
  type: "recurring",
  interval,
  id,
  name,
  amountCents,
  description,
});

export const SKUS = [
  // Launch tiers
  oneTime(
    "launch",
    "launch_fast_track",
    "Fast Track",
    1500,
    "Skip the queue, no badge required, guaranteed dofollow link.",
  ),
  oneTime("launch", "launch_pro", "Pro Debut", 3900, "Pick your week, 7 days featured, newsletter inclusion."),
  oneTime("launch", "launch_premium", "Premium Debut", 7900, "30 days featured, social posts, written launch post."),
  oneTime(
    "launch",
    "launch_spotlight",
    "Spotlight",
    14900,
    "Homepage hero for debut week plus a 40-directory submission package.",
  ),
  oneTime("relaunch", "relaunch", "Relaunch", 1500, "One more week on the board for a new version."),

  // Featured placements
  oneTime(
    "featured",
    "featured_leaderboard_week",
    "Leaderboard slot (1 week)",
    1500,
    "Rotating featured slot between #3 and #4.",
  ),
  oneTime("featured", "featured_home_rail_week", "Homepage rail (1 week)", 2900, "Featured rail on the homepage."),
  oneTime("featured", "featured_home_rail_month", "Homepage rail (1 month)", 8900, "Featured rail on the homepage."),
  oneTime("featured", "featured_home_top_week", "Homepage top sponsor (1 week)", 5900, "The single top sponsor slot."),
  oneTime(
    "featured",
    "featured_home_top_month",
    "Homepage top sponsor (1 month)",
    17900,
    "The single top sponsor slot.",
  ),
  oneTime("featured", "featured_category_week", "Category sponsor (1 week)", 1900, "Sponsor one category page."),
  oneTime(
    "featured",
    "featured_newsletter_issue",
    "Newsletter sponsor (1 issue)",
    4900,
    "Sponsor one weekly newsletter.",
  ),

  // Directory submission service (done in-house)
  oneTime(
    "submission",
    "submission_starter",
    "Submissions: Starter",
    9900,
    "40 niche-matched directories, live tracking, 3 months Link Monitor.",
  ),
  oneTime(
    "submission",
    "submission_growth",
    "Submissions: Growth",
    17900,
    "100 directories, live tracking, 6 months Link Monitor.",
  ),
  oneTime(
    "submission",
    "submission_scale",
    "Submissions: Scale",
    29900,
    "180+ directories, tailored copy, 12 months Link Monitor.",
  ),

  // Subscriptions
  recurring("sub_link_monitor_100", "Yard Monitor (100 links)", 900, "monthly", "Weekly link checks with alerts."),
  recurring("sub_link_monitor_500", "Yard Monitor (500 links)", 1900, "monthly", "Weekly link checks with alerts."),
  recurring(
    "sub_maker_pro_monthly",
    "Maker Pro (monthly)",
    1200,
    "monthly",
    "DR tracking, analytics, a free Fast Track each quarter.",
  ),
  recurring(
    "sub_maker_pro_yearly",
    "Maker Pro (yearly)",
    9900,
    "annually",
    "DR tracking, analytics, a free Fast Track each quarter.",
  ),
  recurring("sub_always_featured", "Always Featured", 4900, "monthly", "Rotating featured placement, cancel anytime."),
  recurring("sub_agency", "Agency", 79900, "monthly", "5 client submissions a month with white-label reports."),
] as const satisfies readonly Sku[];

export type SkuId = (typeof SKUS)[number]["id"];

const byId = new Map<string, Sku>(SKUS.map((s) => [s.id, s]));

export function getSku(id: string): Sku | undefined {
  return byId.get(id);
}

/**
 * What can be bought directly from /api/checkout. Launch tiers are sold in the
 * submit flow and featured slots through the /advertise booking calendar;
 * plans wait for their features (Phase 4).
 */
export function isPurchasable(sku: Sku): boolean {
  return sku.type === "one_time" && sku.kind === "submission";
}

export function isSkuId(id: string): id is SkuId {
  return byId.has(id);
}

/** Formats cents as "$15" or "$15.50". */
export function formatUsd(cents: number): string {
  const dollars = cents / 100;
  return `$${Number.isInteger(dollars) ? dollars : dollars.toFixed(2)}`;
}
