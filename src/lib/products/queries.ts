import "server-only";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { env } from "@/env";
import type { ProductInput } from "./input";

export async function listCategories() {
  return db()
    .select({ slug: schema.categories.slug, name: schema.categories.name })
    .from(schema.categories)
    .orderBy(asc(schema.categories.position));
}

export function uploadsEnabled(): boolean {
  const e = env();
  return Boolean(e.R2_ACCOUNT_ID && e.R2_ACCESS_KEY_ID && e.R2_SECRET_ACCESS_KEY && e.R2_BUCKET && e.R2_PUBLIC_URL);
}

/** Homepage screenshots on fetch need the screenshot worker, which writes to R2. */
export function screenshotsEnabled(): boolean {
  const e = env();
  return uploadsEnabled() && Boolean(e.WORKER_URL && e.WORKER_SECRET);
}

/** A maker's own listing in form shape, or null if it isn't theirs. */
export async function getEditableProduct(productId: string, userId: string) {
  const p = await db().query.products.findFirst({ where: eq(schema.products.id, productId) });
  if (!p || p.createdBy !== userId) return null;
  const [cats, media] = await Promise.all([
    db()
      .select({ slug: schema.productCategories.categorySlug })
      .from(schema.productCategories)
      .where(eq(schema.productCategories.productId, p.id)),
    db().query.productMedia.findMany({
      where: eq(schema.productMedia.productId, p.id),
      orderBy: asc(schema.productMedia.position),
      columns: { url: true },
    }),
  ]);
  const input: ProductInput = {
    websiteUrl: p.websiteUrl,
    name: p.name,
    tagline: p.tagline,
    description: p.description,
    logoUrl: p.logoUrl ?? "",
    categories: cats.map((c) => c.slug),
    pricingModel: p.pricingModel,
    twitterUrl: p.twitterUrl ?? "",
    githubUrl: p.githubUrl ?? "",
    screenshots: media.map((m) => m.url),
  };
  return { product: p, input };
}
