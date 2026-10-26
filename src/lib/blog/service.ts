import "server-only";
import { and, desc, eq, isNotNull, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { weekBoard } from "@/lib/board/queries";
import { notifyRecapDrafted } from "@/lib/notifications";
import { slugify, uniqueSlug } from "@/lib/slug";
import { addWeeks, formatWeekLabel, formatWeekRange, weekKeyFor } from "@/lib/weeks";
import { escapeMarkdown, excerptFrom } from "./markdown";

const { posts, launchWeeks } = schema;
export type Post = typeof posts.$inferSelect;

export class PostError extends Error {}

export const formatPostDate = (d: Date | null) =>
  d ? d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) : "";

export const postInput = z.object({
  title: z.string().trim().min(3, "Give the post a title.").max(140),
  slug: z
    .string()
    .trim()
    .max(80)
    .regex(/^[a-z0-9-]*$/, "Slugs use lowercase letters, numbers and dashes.")
    .default(""),
  excerpt: z.string().trim().max(300).default(""),
  body: z.string().max(100_000).default(""),
  coverUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => v === "" || /^https:\/\//.test(v), "Cover images must be https URLs.")
    .default(""),
});
export type PostInput = z.input<typeof postInput>;

const slugTaken = (exceptId?: string) => async (slug: string) =>
  Boolean(
    await db().query.posts.findFirst({
      where: exceptId ? and(eq(posts.slug, slug), sql`${posts.id} <> ${exceptId}`) : eq(posts.slug, slug),
      columns: { id: true },
    }),
  );

export async function savePost(authorId: string, raw: PostInput, id?: string): Promise<Post> {
  const input = postInput.parse(raw);
  const slug = await uniqueSlug(input.slug || slugify(input.title, 80), slugTaken(id));
  const values = {
    title: input.title,
    slug,
    excerpt: input.excerpt || excerptFrom(input.body),
    body: input.body,
    coverUrl: input.coverUrl || null,
  };
  if (id) {
    const [row] = await db().update(posts).set(values).where(eq(posts.id, id)).returning();
    if (!row) throw new PostError("Post not found.");
    return row;
  }
  const [row] = await db()
    .insert(posts)
    .values({ ...values, authorId })
    .returning();
  return row;
}

export async function setPublished(id: string, published: boolean): Promise<Post> {
  const current = await db().query.posts.findFirst({ where: eq(posts.id, id) });
  if (!current) throw new PostError("Post not found.");
  if (published && !current.body.trim()) throw new PostError("Write something before publishing.");
  const [row] = await db()
    .update(posts)
    .set(published ? { status: "published", publishedAt: current.publishedAt ?? new Date() } : { status: "draft" })
    .where(eq(posts.id, id))
    .returning();
  return row;
}

export async function deletePost(id: string) {
  await db().delete(posts).where(eq(posts.id, id));
}

export async function getPost(id: string) {
  return db().query.posts.findFirst({ where: eq(posts.id, id) });
}

export async function allPosts() {
  return db().select().from(posts).orderBy(desc(posts.updatedAt));
}

// Compared with Postgres's clock, so rendering a post never reads the time during prerender.
const isLive = () =>
  and(eq(posts.status, "published"), isNotNull(posts.publishedAt), lte(posts.publishedAt, sql`now()`));

export async function publishedPosts(limit = 50) {
  return db()
    .select({
      slug: posts.slug,
      title: posts.title,
      excerpt: posts.excerpt,
      coverUrl: posts.coverUrl,
      kind: posts.kind,
      publishedAt: posts.publishedAt,
      updatedAt: posts.updatedAt,
    })
    .from(posts)
    .where(isLive())
    .orderBy(desc(posts.publishedAt))
    .limit(limit);
}

export async function publishedPost(slug: string) {
  const [row] = await db()
    .select({ p: posts, authorName: schema.user.name })
    .from(posts)
    .leftJoin(schema.user, eq(schema.user.id, posts.authorId))
    .where(and(eq(posts.slug, slug), isLive()));
  return row ? { ...row.p, authorName: row.authorName } : null;
}

const MEDALS = ["🥇", "🥈", "🥉"];

/** Markdown for a closed week's recap. Maker text is escaped. */
export async function recapMarkdown(weekKey: string) {
  const [board, awards] = await Promise.all([
    weekBoard(weekKey),
    db().query.awards.findMany({
      where: and(eq(schema.awards.scope, "week"), eq(schema.awards.periodKey, weekKey)),
      orderBy: (a, { asc }) => asc(a.place),
    }),
  ]);
  if (board.length === 0) return null;

  const label = formatWeekLabel(weekKey);
  const byId = new Map(board.map((p) => [p.id, p]));
  const winners = awards.map((a) => ({ a, p: byId.get(a.productId) })).filter((x) => x.p);
  const winnerIds = new Set(winners.map((w) => w.p!.id));
  const others = board.filter((p) => !winnerIds.has(p.id));
  const totalVotes = board.reduce((n, p) => n + p.votes, 0);
  const name = (p: { name: string }) => escapeMarkdown(p.name);
  const line = (p: (typeof board)[number]) => `[${name(p)}](/p/${p.slug}): ${escapeMarkdown(p.tagline)}`;

  const top = winners[0]?.p;
  const title = top ? `${label} recap: ${top.name} takes Debut of the Week` : `${label} recap`;
  const parts = [
    `${board.length} product${board.length === 1 ? "" : "s"} debuted on DebutYard in ${label} (${formatWeekRange(weekKey)}), and the community cast ${totalVotes} vote${totalVotes === 1 ? "" : "s"}.`,
  ];
  if (winners.length) {
    parts.push(
      "## Debut of the Week",
      winners
        .map(({ a, p }) => `${MEDALS[a.place - 1] ?? `#${a.place}`} **${line(p!)}** (${p!.votes} votes)`)
        .join("\n\n"),
    );
  }
  if (others.length) {
    parts.push(
      "## Also debuting",
      others
        .slice(0, 12)
        .map((p) => `- ${line(p)}`)
        .join("\n"),
    );
    if (others.length > 12) parts.push(`[See all ${board.length} debuts from ${label}](/week/${weekKey})`);
  }
  parts.push(
    "## Debut next",
    "A new class debuts every Monday. [Submit your product](/submit) or [vote on this week's debuts](/).",
  );
  return { title, body: parts.join("\n\n") };
}

/**
 * Drafts the recap for the week that just closed, once. Staff edit and publish
 * it by hand, adding a line about each winner.
 */
export async function draftWeeklyRecap(now = new Date()) {
  const weekKey = addWeeks(weekKeyFor(now), -1);
  const week = await db().query.launchWeeks.findFirst({
    where: and(eq(launchWeeks.key, weekKey), isNotNull(launchWeeks.closedAt)),
  });
  if (!week) return { skipped: "week not closed" };
  if (await db().query.posts.findFirst({ where: eq(posts.weekKey, weekKey), columns: { id: true } })) {
    return { skipped: "already drafted" };
  }

  const recap = await recapMarkdown(weekKey);
  if (!recap) return { skipped: "no debuts" };
  const slug = await uniqueSlug(slugify(`${formatWeekLabel(weekKey)} recap`, 80), slugTaken());
  const [row] = await db()
    .insert(posts)
    .values({
      kind: "recap",
      weekKey,
      slug,
      title: recap.title,
      body: recap.body,
      excerpt: excerptFrom(recap.body),
    })
    .onConflictDoNothing()
    .returning();
  if (!row) return { skipped: "already drafted" };
  await notifyRecapDrafted(row).catch((err) => console.error("recap draft email failed", err));
  return { drafted: row.slug };
}
