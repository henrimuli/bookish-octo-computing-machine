import "server-only";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { env } from "@/env";
import { getProductPage } from "@/lib/board/queries";
import { dashboardProducts } from "@/lib/products/dashboard";
import { productInput } from "@/lib/products/input";
import { listCategories } from "@/lib/products/queries";
import { isLiveCondition, ProductError, saveProduct } from "@/lib/products/service";
import { checkReadiness, ReadinessError } from "@/lib/readiness/service";
import { formatWeekLabel } from "@/lib/weeks";
import type { ApiUser } from "./tokens";

/**
 * The operations behind both the REST API and the MCP server. Agents can read
 * and draft; publishing, paying and review always happen in the browser.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 401 | 404 | 429 = 400,
  ) {
    super(message);
  }
}

const site = (path: string) => new URL(path, env().NEXT_PUBLIC_SITE_URL).toString();

export const searchInput = z.object({
  query: z.string().trim().max(100).optional().describe("Words to match in the name or tagline"),
  category: z.string().max(64).optional().describe("Category slug, e.g. developer-tools"),
  limit: z.number().int().min(1).max(50).default(20),
});

export async function searchProducts(raw: z.input<typeof searchInput>) {
  const input = searchInput.parse(raw);
  const { products, productCategories } = schema;
  const q = input.query ? `%${input.query.replace(/[%_\\]/g, "\\$&")}%` : null;
  const rows = await db()
    .select({
      slug: products.slug,
      name: products.name,
      tagline: products.tagline,
      websiteUrl: products.websiteUrl,
      launchWeekKey: products.launchWeekKey,
      votes: sql<number>`(select count(*)::int from votes v where v.product_id = ${products.id})`,
    })
    .from(products)
    .where(
      and(
        isLiveCondition(),
        q ? or(ilike(products.name, q), ilike(products.tagline, q)) : undefined,
        input.category
          ? sql`exists (select 1 from ${productCategories} pc where pc.product_id = ${products.id} and pc.category_slug = ${input.category})`
          : undefined,
      ),
    )
    .orderBy(desc(products.approvedAt))
    .limit(input.limit);
  return rows.map((r) => ({
    slug: r.slug,
    name: r.name,
    tagline: r.tagline,
    website: r.websiteUrl,
    url: site(`/p/${r.slug}`),
    debutWeek: r.launchWeekKey,
    votes: r.votes,
  }));
}

export const getInput = z.object({ slug: z.string().max(80).describe("Product slug from search results") });

export async function getProduct(raw: z.input<typeof getInput>) {
  const { slug } = getInput.parse(raw);
  const data = await getProductPage(slug, null);
  if (!data) throw new ApiError("No live product with that slug.", 404);
  const p = data.product;
  return {
    slug: p.slug,
    name: p.name,
    tagline: p.tagline,
    description: p.description,
    website: p.websiteUrl,
    url: site(`/p/${p.slug}`),
    logoUrl: p.logoUrl,
    pricingModel: p.pricingModel,
    categories: data.categories,
    maker: data.maker ? { name: data.maker.name, handle: data.maker.handle } : null,
    debutWeek: p.launchWeekKey ? { key: p.launchWeekKey, label: formatWeekLabel(p.launchWeekKey) } : null,
    votes: data.votes,
    weekRank: data.weekRank,
    awards: data.awards.map((a) => ({ scope: a.scope, period: a.periodKey, place: a.place })),
  };
}

export async function categories() {
  return listCategories();
}

export const readinessInput = z.object({ url: z.string().max(500).describe("The product's website") });

export async function readiness(
  raw: z.input<typeof readinessInput>,
  caller: { clientKey: string; user: ApiUser | null; source: "api" | "mcp" },
) {
  const { url } = readinessInput.parse(raw);
  try {
    return await checkReadiness(url, { clientKey: caller.clientKey, userId: caller.user?.id, source: caller.source });
  } catch (err) {
    if (err instanceof ReadinessError) throw new ApiError(err.message, err.message.includes("hour") ? 429 : 400);
    throw err;
  }
}

export const draftInput = productInput.pick({
  websiteUrl: true,
  name: true,
  tagline: true,
  description: true,
  categories: true,
  pricingModel: true,
  logoUrl: true,
  twitterUrl: true,
  githubUrl: true,
});

/** Creates a draft listing. The maker reviews it, picks a plan and submits in the browser. */
export async function draftSubmission(raw: unknown, user: ApiUser | null, via: "api" | "mcp") {
  if (!user) throw new ApiError("This needs an API token. Create one at " + site("/dashboard/api"), 401);
  const parsed = draftInput.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new ApiError(`${issue?.path.join(".") || "input"}: ${issue?.message ?? "invalid"}`);
  }
  const known = new Set((await listCategories()).map((c) => c.slug));
  const unknown = parsed.data.categories.filter((c) => !known.has(c));
  if (unknown.length) throw new ApiError(`Unknown categories: ${unknown.join(", ")}. Call list_categories.`);
  try {
    const p = await saveProduct(user.id, parsed.data);
    await db().update(schema.products).set({ createdVia: via }).where(eq(schema.products.id, p.id));
    return {
      id: p.id,
      slug: p.slug,
      status: p.status,
      nextStep: `Open ${site(`/submit/${p.id}`)} to review the draft, pick a free or paid debut, and submit it.`,
    };
  } catch (err) {
    if (err instanceof ProductError) throw new ApiError(err.message);
    throw err;
  }
}

export async function myLaunches(user: ApiUser | null) {
  if (!user) throw new ApiError("This needs an API token. Create one at " + site("/dashboard/api"), 401);
  const items = await dashboardProducts(user.id);
  return items.map(({ product: p, badge, stats }) => ({
    id: p.id,
    slug: p.slug,
    name: p.name,
    status: p.status,
    tier: p.tier,
    debutWeek: p.launchWeekKey,
    badge: badge?.status ?? "unverified",
    votes: stats.votes,
    comments: stats.comments,
    views30d: stats.views_30d,
    clicks30d: stats.clicks_30d,
    url: p.status === "approved" ? site(`/p/${p.slug}`) : site(`/submit/${p.id}`),
    rejectionReason: p.rejectionReason,
  }));
}

export async function myLinks(user: ApiUser | null) {
  if (!user) throw new ApiError("This needs an API token. Create one at " + site("/dashboard/api"), 401);
  const { linksForUser, linkUsage } = await import("@/lib/links/service");
  const [rows, usage] = await Promise.all([linksForUser(user.id), linkUsage(user.id)]);
  return {
    usage: { manualLinks: usage.used, limit: usage.limit, monitored: usage.monitored },
    links: rows.map(({ link: l, directory }) => ({
      id: l.id,
      url: l.url,
      target: l.targetDomain,
      directory,
      source: l.source,
      monitored: l.active,
      verdict: l.lastVerdict,
      rel: l.lastRel,
      anchor: l.lastAnchor,
      httpStatus: l.lastStatusCode,
      lastCheckedAt: l.lastCheckedAt?.toISOString() ?? null,
      nextCheckAt: l.active ? l.nextCheckAt.toISOString() : null,
    })),
  };
}

/** JSON Schema for an input, without the `$schema` key (MCP and OpenAPI embed it). */
export function inputJsonSchema(s: z.ZodType): Record<string, unknown> {
  const out = z.toJSONSchema(s, { io: "input" }) as Record<string, unknown>;
  delete out.$schema;
  return out;
}

export const directoriesInput = z.object({
  niche: z.enum(["general", "devtools", "ai", "indie", "b2b"]).optional().describe("Directory niche"),
  pricing: z.enum(["free", "freemium", "paid"]).optional(),
  noBadge: z.boolean().optional().describe("Only directories that don't require a badge"),
  dofollow: z.boolean().optional().describe("Only directories that give a dofollow link"),
});

/** Launch directories from our database, with what we've verified about them. */
export async function launchDirectories(raw: z.input<typeof directoriesInput>) {
  const { listDirectories, effectiveLinkType } = await import("@/lib/directories/service");
  const rows = await listDirectories(directoriesInput.parse(raw));
  return rows.map((d) => ({
    slug: d.slug,
    name: d.name,
    url: d.url,
    submitUrl: d.submitUrl ?? d.url,
    niche: d.niche,
    pricing: d.pricing,
    dr: d.dr,
    linkType: effectiveLinkType(d),
    linkTypeVerified: d.linkTypeObserved !== "unknown",
    badgeRequired: d.badgeRequired,
    needsMakerPersonally: d.guided,
    acceptanceRate: d.acceptanceRate,
    info: site(`/directories/${d.slug}`),
  }));
}
