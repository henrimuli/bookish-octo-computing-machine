import "server-only";
import { desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { queueAhead } from "./service";

/** A maker's listings with everything the dashboard shows. */
export async function dashboardProducts(userId: string) {
  const rows = await db()
    .select({ product: schema.products, badge: schema.badgeVerifications })
    .from(schema.products)
    .leftJoin(schema.badgeVerifications, eq(schema.badgeVerifications.productId, schema.products.id))
    .where(eq(schema.products.createdBy, userId))
    .orderBy(desc(schema.products.createdAt));

  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.product.id);

  const stats = (await db().execute(sql`
    select p.id,
      (select count(*)::int from votes v where v.product_id = p.id) as votes,
      (select count(*)::int from comments c where c.product_id = p.id and c.status = 'visible') as comments,
      (select count(*)::int from product_events e where e.product_id = p.id and e.kind = 'view'
         and e.created_at > now() - interval '30 days') as views_30d,
      (select count(*)::int from product_events e where e.product_id = p.id and e.kind = 'outbound_click'
         and e.created_at > now() - interval '30 days') as clicks_30d
    from products p where p.id in (${sql.join(
      ids.map((id) => sql`${id}`),
      sql`, `,
    )})
  `)) as unknown as Array<{ id: string; votes: number; comments: number; views_30d: number; clicks_30d: number }>;
  const statsBy = new Map(stats.map((s) => [s.id, s]));

  return Promise.all(
    rows.map(async ({ product, badge }) => ({
      product,
      badge,
      stats: statsBy.get(product.id) ?? { votes: 0, comments: 0, views_30d: 0, clicks_30d: 0 },
      queueAhead: await queueAhead(product),
    })),
  );
}
