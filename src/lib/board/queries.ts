import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { weekBounds, weekKeyFor } from "@/lib/weeks";
import { COMMENT_BONUS, MIN_COMMENT_LENGTH, rank } from "./ranking";

export type BoardItem = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  logoUrl: string | null;
  tier: "free" | "fast_track" | "pro" | "premium" | "spotlight";
  approvedAt: Date | null;
  votes: number;
  comments: number;
  score: number;
  categories: Array<{ slug: string; name: string }>;
  votedByMe: boolean;
  rank: number;
};

type Row = Omit<BoardItem, "rank" | "categories" | "score" | "votes" | "comments" | "votedByMe" | "approvedAt"> & {
  approved_at: Date | string | null;
  logo_url: string | null;
  votes: string | number;
  comments: string | number;
  score: string | number;
  voted_by_me: boolean;
  categories: Array<{ slug: string; name: string }> | null;
};

/**
 * Products approved for a week, ranked. Votes and comments only count toward
 * the score if cast during the week; displayed counts are all-time.
 */
export async function weekBoard(weekKey: string, viewerId: string | null = null): Promise<BoardItem[]> {
  const { startsAt: start, endsAt: end } = weekBounds(weekKey);
  // postgres-js via drizzle's raw sql doesn't serialise Date params: bind ISO strings and cast.
  const startsAt = sql`${start.toISOString()}::timestamptz`;
  const endsAt = sql`${end.toISOString()}::timestamptz`;
  const rows = (await db().execute(sql`
    select p.id, p.slug, p.name, p.tagline, p.logo_url, p.tier, p.approved_at,
      (select count(*) from votes v where v.product_id = p.id) as votes,
      (select count(*) from comments c where c.product_id = p.id and c.status = 'visible') as comments,
      coalesce((select sum(v.weight) from votes v
                where v.product_id = p.id and not v.flagged
                  and v.created_at >= ${startsAt} and v.created_at < ${endsAt}), 0)
      + ${COMMENT_BONUS}::float8 * (select count(distinct c.user_id) from comments c
                where c.product_id = p.id and c.status = 'visible' and c.user_id <> p.created_by
                  and char_length(c.body) >= ${MIN_COMMENT_LENGTH}
                  and c.created_at >= ${startsAt} and c.created_at < ${endsAt}) as score,
      exists(select 1 from votes v where v.product_id = p.id and v.user_id = ${viewerId}) as voted_by_me,
      (select json_agg(json_build_object('slug', cat.slug, 'name', cat.name) order by cat.position)
         from product_categories pc join categories cat on cat.slug = pc.category_slug
        where pc.product_id = p.id) as categories
    from products p
    where p.status = 'approved' and p.launch_week_key = ${weekKey}
  `)) as unknown as Row[];

  return rank(
    rows.map((r) => ({
      id: r.id,
      slug: r.slug,
      name: r.name,
      tagline: r.tagline,
      logoUrl: r.logo_url,
      tier: r.tier,
      approvedAt: r.approved_at ? new Date(r.approved_at) : null,
      votes: Number(r.votes),
      comments: Number(r.comments),
      score: Number(r.score),
      votedByMe: Boolean(r.voted_by_me),
      categories: r.categories ?? [],
    })),
  );
}

/** Weeks that have started and have at least one debut, newest first. */
export async function weekArchive(limit = 52) {
  const current = weekKeyFor(new Date());
  return db()
    .select({ key: schema.products.launchWeekKey, count: sql<number>`count(*)::int` })
    .from(schema.products)
    .where(and(eq(schema.products.status, "approved"), sql`${schema.products.launchWeekKey} <= ${current}`))
    .groupBy(schema.products.launchWeekKey)
    .orderBy(desc(schema.products.launchWeekKey))
    .limit(limit) as Promise<Array<{ key: string; count: number }>>;
}

/** Live products in a category, most voted first. */
export async function categoryProducts(slug: string, limit = 60) {
  const current = weekKeyFor(new Date());
  return (await db().execute(sql`
    select p.id, p.slug, p.name, p.tagline, p.logo_url, p.launch_week_key,
      (select count(*)::int from votes v where v.product_id = p.id) as votes
    from products p
    join product_categories pc on pc.product_id = p.id and pc.category_slug = ${slug}
    where p.status = 'approved' and p.launch_week_key <= ${current}
    order by votes desc, p.approved_at desc
    limit ${limit}
  `)) as unknown as Array<{
    id: string;
    slug: string;
    name: string;
    tagline: string;
    logo_url: string | null;
    launch_week_key: string;
    votes: number;
  }>;
}

export async function categoriesWithCounts() {
  const current = weekKeyFor(new Date());
  return (await db().execute(sql`
    select c.slug, c.name, count(p.id)::int as count
    from categories c
    left join product_categories pc on pc.category_slug = c.slug
    left join products p on p.id = pc.product_id and p.status = 'approved' and p.launch_week_key <= ${current}
    group by c.slug, c.name, c.position
    order by c.position
  `)) as unknown as Array<{ slug: string; name: string; count: number }>;
}

export async function getCategory(slug: string) {
  return db().query.categories.findFirst({ where: eq(schema.categories.slug, slug) });
}

export type ProductDetail = Awaited<ReturnType<typeof getProductPage>>;

/**
 * Everything the product page needs. Returns null unless the product is live,
 * or the viewer is its maker or staff (preview).
 */
export async function getProductPage(slug: string, viewer: { id: string; staff: boolean } | null) {
  const p = await db().query.products.findFirst({ where: eq(schema.products.slug, slug) });
  if (!p) return null;
  const current = weekKeyFor(new Date());
  const live = p.status === "approved" && p.launchWeekKey !== null && p.launchWeekKey <= current;
  const canPreview = viewer && (viewer.staff || viewer.id === p.createdBy);
  if (!live && !canPreview) return null;

  const [maker, cats, badge, media, awards] = await Promise.all([
    db().query.user.findFirst({
      where: eq(schema.user.id, p.createdBy),
      columns: { id: true, name: true, handle: true, image: true },
    }),
    db()
      .select({ slug: schema.categories.slug, name: schema.categories.name })
      .from(schema.productCategories)
      .innerJoin(schema.categories, eq(schema.categories.slug, schema.productCategories.categorySlug))
      .where(eq(schema.productCategories.productId, p.id)),
    db().query.badgeVerifications.findFirst({ where: eq(schema.badgeVerifications.productId, p.id) }),
    db().query.productMedia.findMany({
      where: eq(schema.productMedia.productId, p.id),
      orderBy: (m, { asc }) => asc(m.position),
    }),
    db().query.awards.findMany({ where: eq(schema.awards.productId, p.id) }),
  ]);

  // Rank within its week, and the rest of that week's board for "launched the same week".
  const board = p.launchWeekKey ? await weekBoard(p.launchWeekKey, viewer?.id ?? null) : [];
  const me = board.find((b) => b.id === p.id);

  return {
    product: p,
    live,
    maker,
    categories: cats,
    badgeStatus: badge?.status ?? "unverified",
    media,
    awards,
    votes: me?.votes ?? 0,
    votedByMe: me?.votedByMe ?? false,
    weekRank: live ? (me?.rank ?? null) : null,
    sameWeek: board.filter((b) => b.id !== p.id).slice(0, 6),
  };
}

/** Live products sharing a category, excluding this one. */
export async function similarProducts(productId: string, limit = 6) {
  const current = weekKeyFor(new Date());
  return (await db().execute(sql`
    select p.slug, p.name, p.tagline, p.logo_url, count(*) as shared
    from product_categories mine
    join product_categories other on other.category_slug = mine.category_slug and other.product_id <> mine.product_id
    join products p on p.id = other.product_id
    where mine.product_id = ${productId} and p.status = 'approved' and p.launch_week_key <= ${current}
    group by p.id
    order by shared desc, p.approved_at desc
    limit ${limit}
  `)) as unknown as Array<{ slug: string; name: string; tagline: string; logo_url: string | null }>;
}

/** Daily vote counts for the product's debut week (for the sparkline). */
export async function votesByDay(productId: string, weekKey: string) {
  const startsAt = sql`${weekBounds(weekKey).startsAt.toISOString()}::timestamptz`;
  const rows = (await db().execute(sql`
    select floor(extract(epoch from (created_at - ${startsAt})) / 86400)::int as day, count(*)::int as n
    from votes where product_id = ${productId}
      and created_at >= ${startsAt} and created_at < ${startsAt} + interval '7 days'
    group by 1
  `)) as unknown as Array<{ day: number; n: number }>;
  const days = Array.from({ length: 7 }, () => 0);
  for (const r of rows) if (r.day >= 0 && r.day < 7) days[r.day] = r.n;
  return days;
}

export async function commentsFor(productId: string) {
  return db()
    .select({
      id: schema.comments.id,
      parentId: schema.comments.parentId,
      body: schema.comments.body,
      createdAt: schema.comments.createdAt,
      userId: schema.comments.userId,
      name: schema.user.name,
      handle: schema.user.handle,
      image: schema.user.image,
    })
    .from(schema.comments)
    .innerJoin(schema.user, eq(schema.user.id, schema.comments.userId))
    .where(and(eq(schema.comments.productId, productId), eq(schema.comments.status, "visible")))
    .orderBy(schema.comments.createdAt);
}

export async function builderByHandle(handle: string) {
  const u = await db().query.user.findFirst({
    where: eq(schema.user.handle, handle),
    columns: { id: true, name: true, handle: true, image: true, createdAt: true },
  });
  if (!u) return null;
  const current = weekKeyFor(new Date());
  const products = (await db().execute(sql`
    select p.slug, p.name, p.tagline, p.logo_url, p.launch_week_key,
      (select count(*)::int from votes v where v.product_id = p.id) as votes
    from products p
    where p.created_by = ${u.id} and p.status = 'approved' and p.launch_week_key <= ${current}
    order by p.launch_week_key desc
  `)) as unknown as Array<{
    slug: string;
    name: string;
    tagline: string;
    logo_url: string | null;
    launch_week_key: string;
    votes: number;
  }>;
  return { user: u, products };
}

/** Recent weekly winners for the homepage. */
export async function recentWinners(limit = 3) {
  return (await db().execute(sql`
    select a.period_key, a.place, p.slug, p.name, p.tagline, p.logo_url
    from awards a join products p on p.id = a.product_id
    where a.scope = 'week'
    order by a.period_key desc, a.place asc
    limit ${limit}
  `)) as unknown as Array<{
    period_key: string;
    place: number;
    slug: string;
    name: string;
    tagline: string;
    logo_url: string | null;
  }>;
}
