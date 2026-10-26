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
  tier: "pro" | "premium" | "spotlight";
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

export async function featuredNow(now = new Date()): Promise<FeaturedItem[]> {
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
  return rows
    .filter((r) => isFeaturedNow(r.tier, r.launch_week_key, now))
    .map((r) => ({
      slug: r.slug,
      name: r.name,
      tagline: r.tagline,
      logoUrl: r.logo_url,
      tier: r.tier,
      hero: isHeroNow(r.tier, r.launch_week_key, now),
    }));
}
