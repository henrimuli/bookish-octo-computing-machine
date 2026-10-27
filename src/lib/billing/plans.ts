/** What each subscription plan unlocks (PLAN §5.4). Pure config. */

export type Feature = "dr_tracking" | "pro_badge" | "free_fast_track" | "early_booking" | "always_featured";
export type Limit = "links";

export type Plan = {
  id: string;
  label: string;
  skus: string[];
  features: Feature[];
  limits: Record<Limit, number>;
};

/** Manual links anyone can monitor without a plan. */
export const FREE_LIMITS: Record<Limit, number> = { links: 10 };

export const PLANS: Plan[] = [
  {
    id: "link_monitor_100",
    label: "Link Monitor",
    skus: ["sub_link_monitor_100"],
    features: [],
    limits: { links: 100 },
  },
  {
    id: "link_monitor_500",
    label: "Link Monitor 500",
    skus: ["sub_link_monitor_500"],
    features: [],
    limits: { links: 500 },
  },
  {
    id: "maker_pro",
    label: "Maker Pro",
    skus: ["sub_maker_pro_monthly", "sub_maker_pro_yearly"],
    features: ["dr_tracking", "pro_badge", "free_fast_track", "early_booking"],
    limits: { links: 100 },
  },
  {
    id: "always_featured",
    label: "Always Featured",
    skus: ["sub_always_featured"],
    features: ["always_featured"],
    limits: { links: 0 },
  },
];

export const planForSku = (sku: string) => PLANS.find((p) => p.skus.includes(sku)) ?? null;

/** Combines a user's plans: every feature, and the highest of each limit. */
export function combine(plans: Plan[]): { features: Set<Feature>; limits: Record<Limit, number> } {
  return {
    features: new Set(plans.flatMap((p) => p.features)),
    limits: { links: Math.max(FREE_LIMITS.links, ...plans.map((p) => p.limits.links)) },
  };
}
