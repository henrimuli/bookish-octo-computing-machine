import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { weekBounds, weekKeyFor } from "@/lib/weeks";

/** How long each paid tier stays in the homepage featured rail, from the start of its debut week. */
export const FEATURED_DAYS = { pro: 7, premium: 30, spotlight: 30 } as const;

export type FeaturedItem = {
  slug: string;
  name: string;
  tagline: string;
  logoUrl: string | null;
  /** "always": an Always Featured subscription. */
  tier: "pro" | "premium" | "spotlight" | "always";
  hero: boolean;
};

/** Is a paid product inside its featured window right now? Pure. */
export function isFeaturedNow(tier: string, weekKey: string, now = new Date()): boolean {
  const days = FEATURED_DAYS[tier as keyof typeof FEATURED_DAYS];
  if (!days) return false;
  const start = weekBounds(weekKey).startsAt.getTime();
  return now.getTime() >= start && now.getTime() < start + days * 86_400_000;
}

/** Spotlight is the homepage hero only during its own debut week. */
export function isHeroNow(tier: string, weekKey: string, now = new Date()): boolean {
  return tier === "spotlight" && weekKeyFor(now) === weekKey;
}

/**
 * What's in the featured rail now: paid debuts inside their window, plus
 * listings on an active Always Featured plan (first, once each).
 */
export async function featuredNow(now = new Date()): Promise<FeaturedItem[]> {
  const { alwaysFeatured } = await import("@/lib/billing/service");
  const always = await alwaysFeatured(now);
  const current = weekKeyFor(now);
  const rows = (await db().execute(sql`
    select slug, name, tagline, logo_url, tier, launch_week_key
    from products
    where status = 'approved' and tier in ('pro', 'premium', 'spotlight') and launch_week_key <= ${current}
    order by case tier when 'spotlight' then 0 when 'premium' then 1 else 2 end, approved_at
  `)) as unknown as Array<{
    slug: string;
    name: string;
    tagline: string;
    logo_url: string | null;
    tier: FeaturedItem["tier"];
    launch_week_key: string;
  }>;
  const subscribed: FeaturedItem[] = always.map((a) => ({
    slug: a.slug,
    name: a.name,
    tagline: a.tagline,
    logoUrl: a.logoUrl,
    tier: "always",
    hero: false,
  }));
  const paid = rows
    .filter((r) => isFeaturedNow(r.tier, r.launch_week_key, now))
    .map((r) => ({
      slug: r.slug,
      name: r.name,
      tagline: r.tagline,
      logoUrl: r.logo_url,
      tier: r.tier,
      hero: isHeroNow(r.tier, r.launch_week_key, now),
    }));
  const seen = new Set(paid.filter((p) => p.hero).map((p) => p.slug));
  return [
    ...paid.filter((p) => p.hero),
    ...subscribed.filter((a) => !seen.has(a.slug) && seen.add(a.slug)),
    ...paid.filter((p) => !p.hero && !seen.has(p.slug)),
  ];
}

/**
 * Category pages without a booked sponsor show an Always Featured listing
 * from that category, rotating daily between subscribers.
 */
export async function alwaysFeaturedSponsor(categorySlug: string, now = new Date()) {
  const { alwaysFeatured } = await import("@/lib/billing/service");
  const always = await alwaysFeatured(now);
  if (always.length === 0) return null;
  const inCategory = (await db().execute(sql`
    select product_id from product_categories where category_slug = ${categorySlug}
  `)) as unknown as Array<{ product_id: string }>;
  const ids = new Set(inCategory.map((r) => r.product_id));
  const pool = always.filter((a) => ids.has(a.id));
  if (pool.length === 0) return null;
  const pick = pool[Math.floor(now.getTime() / 86_400_000) % pool.length];
  return {
    bookingId: null,
    placement: "category" as const,
    slug: pick.slug,
    name: pick.name,
    tagline: pick.tagline,
    logoUrl: pick.logoUrl,
    href: `/p/${pick.slug}`,
  };
}
