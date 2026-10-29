import "server-only";
import { sql } from "drizzle-orm";
import { queryRows } from "@/db";
import { addWeeks, weekKeyFor } from "@/lib/weeks";

export type DuelProduct = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  logoUrl: string | null;
  categories: string[];
};

/**
 * Two random live products from this week (or last week, if this week is thin)
 * that the viewer hasn't applauded yet. Null when there aren't two left.
 */
export async function duelPair(
  viewerId: string | null,
  excludeIds: string[] = [],
): Promise<[DuelProduct, DuelProduct] | null> {
  const current = weekKeyFor(new Date());
  const weeks = [current, addWeeks(current, -1)];
  const exclude = excludeIds.length
    ? sql`and p.id not in (${sql.join(
        excludeIds.map((id) => sql`${id}::uuid`),
        sql`, `,
      )})`
    : sql``;
  const rows = (await queryRows(sql`
    select p.id, p.slug, p.name, p.tagline, left(p.description, 280) as description, p.logo_url,
      coalesce((select array_agg(c.name order by c.position) from product_categories pc
                join categories c on c.slug = pc.category_slug where pc.product_id = p.id), '{}') as categories
    from products p
    where p.status = 'approved' and p.launch_week_key in (${weeks[0]}, ${weeks[1]})
      and not exists (select 1 from applause v where v.product_id = p.id and v.user_id = ${viewerId})
      ${exclude}
    order by (p.launch_week_key = ${current}) desc, random()
    limit 2
  `)) as unknown as Array<{
    id: string;
    slug: string;
    name: string;
    tagline: string;
    description: string;
    logo_url: string | null;
    categories: string[];
  }>;
  if (rows.length < 2) return null;
  const map = (r: (typeof rows)[number]): DuelProduct => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    tagline: r.tagline,
    description: r.description,
    logoUrl: r.logo_url,
    categories: r.categories,
  });
  return [map(rows[0]), map(rows[1])];
}
