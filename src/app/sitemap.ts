import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { env } from "@/env";
import { weekKeyFor } from "@/lib/weeks";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  const base = env().NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  const staticPages = [
    "",
    "/pricing",
    "/weeks",
    "/categories",
    "/how-ranking-works",
    "/terms",
    "/privacy",
    "/refund-policy",
  ];
  const entries: MetadataRoute.Sitemap = staticPages.map((p) => ({ url: `${base}${p}` }));

  try {
    const current = weekKeyFor(new Date());
    const products = (await db().execute(sql`
      select slug, updated_at from products
      where status = 'approved' and launch_week_key <= ${current}
      order by approved_at desc limit 45000
    `)) as unknown as Array<{ slug: string; updated_at: Date | string }>;
    const weeks = (await db().execute(sql`
      select distinct launch_week_key as key from products
      where status = 'approved' and launch_week_key <= ${current}
    `)) as unknown as Array<{ key: string }>;
    const categories = (await db().execute(sql`select slug from categories`)) as unknown as Array<{ slug: string }>;

    entries.push(
      ...products.map((p) => ({ url: `${base}/p/${p.slug}`, lastModified: new Date(p.updated_at) })),
      ...weeks.map((w) => ({ url: `${base}/week/${w.key}` })),
      ...categories.map((c) => ({ url: `${base}/category/${c.slug}` })),
    );
  } catch (err) {
    console.error("sitemap: database unavailable", err);
  }
  return entries;
}
