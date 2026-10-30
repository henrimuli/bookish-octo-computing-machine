import "server-only";
import { and, asc, desc, eq, inArray, lte, ne, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { tierForSku, type Tier } from "@/lib/products/input";
import { addWeeks, weekBounds, weekKeyFor } from "@/lib/weeks";

const { perkTasks, products, newsletterIssues } = schema;

export type PerkTask = typeof perkTasks.$inferSelect;
export type PerkKind = PerkTask["kind"];
type Product = typeof products.$inferSelect;
type Order = Pick<typeof schema.orders.$inferSelect, "id" | "paidAt">;

export class PerkError extends Error {}

/** What each paid tier promises that the team delivers (see plan-choices.ts). */
export const PERKS_BY_TIER: Partial<Record<Tier, PerkKind[]>> = {
  pro: ["newsletter"],
  premium: ["newsletter", "launch_post"],
  spotlight: ["newsletter_top", "launch_post"],
};

export const PERK_LABELS: Record<PerkKind, string> = {
  newsletter: "Newsletter mention",
  newsletter_top: "Top newsletter slot",
  launch_post: "Launch post",
};

const DAY = 24 * 60 * 60 * 1000;
const isNewsletter = (k: PerkKind) => k === "newsletter" || k === "newsletter_top";

/**
 * The next digest to go out, keyed like newsletter_issues: the week that
 * closes before it. Last week's issue goes out on Monday, so until it's been
 * claimed it's still the next one.
 */
export async function nextIssueWeek(now = new Date()): Promise<string> {
  const lastWeek = addWeeks(weekKeyFor(now), -1);
  const sent = await db().query.newsletterIssues.findFirst({
    where: eq(newsletterIssues.weekKey, lastWeek),
    columns: { weekKey: true },
  });
  return sent ? weekKeyFor(now) : lastWeek;
}

/**
 * Stores the to-dos for a paid debut's perks. Safe to call again for the same
 * order (unique on order + kind). A listing that already has a perk from an
 * earlier order doesn't get it twice; upgrading to Spotlight swaps an open
 * newsletter mention for the top slot. Returns the order's tasks, so a retried
 * fulfilment can still email them.
 */
export async function createPerkTasks(order: Order, p: Product, tier: Tier, now = new Date()): Promise<PerkTask[]> {
  const kinds = PERKS_BY_TIER[tier] ?? [];
  if (kinds.length === 0) return [];
  const paidAt = order.paidAt ?? now;
  const thisWeek = weekKeyFor(paidAt);
  const launchWeek = p.launchWeekKey ?? p.requestedWeekKey ?? thisWeek;
  const nextIssue = await nextIssueWeek(now);
  const existing = await db().query.perkTasks.findMany({ where: eq(perkTasks.productId, p.id) });

  const prior = existing.filter((t) => t.orderId !== order.id && t.status !== "skipped");
  const values: Array<typeof perkTasks.$inferInsert> = [];
  for (const kind of kinds) {
    if (kind === "launch_post" && prior.some((t) => t.kind === "launch_post")) continue;
    if (kind === "newsletter" && prior.some((t) => isNewsletter(t.kind))) continue;
    if (kind === "newsletter_top" && prior.some((t) => t.kind === "newsletter_top")) continue;
    // The issue whose "Debuting now" week is the launch week, unless that's already gone out.
    const issueForLaunch = addWeeks(launchWeek, -1);
    values.push({
      productId: p.id,
      orderId: order.id,
      kind,
      weekKey:
        kind === "launch_post"
          ? launchWeek
          : kind === "newsletter_top"
            ? nextIssue
            : issueForLaunch > nextIssue
              ? issueForLaunch
              : nextIssue,
      dueAt:
        kind !== "launch_post"
          ? null
          : tier === "spotlight"
            ? new Date(paidAt.getTime() + 7 * DAY)
            : // Sunday 23:59:59.999 UTC, the last moment of the launch week.
              new Date(weekBounds(launchWeek).endsAt.getTime() - 1),
    });
  }
  if (values.length === 0) return [];

  await db().insert(perkTasks).values(values).onConflictDoNothing();
  const tasks = await db().query.perkTasks.findMany({
    where: eq(perkTasks.orderId, order.id),
    orderBy: asc(perkTasks.kind),
  });
  if (tasks.some((t) => t.kind === "newsletter_top")) {
    await db()
      .update(perkTasks)
      .set({ status: "skipped", skipReason: "Upgraded to Spotlight (top slot)" })
      .where(and(eq(perkTasks.productId, p.id), eq(perkTasks.kind, "newsletter"), eq(perkTasks.status, "suggested")));
  }
  return tasks;
}

/**
 * One-off: tasks for listings paid for before perk tasks existed, whose launch
 * week is this week or later. Safe to re-run. Returns how many were created.
 */
export async function backfillPerkTasks(now = new Date()): Promise<number> {
  const { orders } = schema;
  const thisWeek = weekKeyFor(now);
  const rows = await db()
    .select({ order: orders, p: products })
    .from(orders)
    .innerJoin(products, sql`${products.id}::text = ${orders.metadata}->>'productId'`)
    .where(
      and(
        eq(orders.kind, "launch"),
        eq(orders.status, "paid"),
        inArray(products.status, ["pending", "approved"]),
        inArray(products.tier, ["pro", "premium", "spotlight"]),
      ),
    )
    .orderBy(asc(orders.paidAt));
  let created = 0;
  for (const { order, p } of rows) {
    const tier = tierForSku(order.sku);
    const launchWeek = p.launchWeekKey ?? p.requestedWeekKey ?? weekKeyFor(order.paidAt ?? now);
    if (!tier || launchWeek < thisWeek) continue;
    const before = await db().$count(perkTasks, eq(perkTasks.orderId, order.id));
    const after = (await createPerkTasks(order, p, tier, now)).length;
    created += after - before;
  }
  return created;
}

/** Open to-dos per admin page, for the sidebar. */
export async function openPerkCounts(): Promise<{ newsletter: number; blog: number }> {
  const rows = await db()
    .select({ kind: perkTasks.kind, n: sql<number>`count(*)::int` })
    .from(perkTasks)
    .where(inArray(perkTasks.status, ["suggested", "drafting"]))
    .groupBy(perkTasks.kind);
  const n = (k: PerkKind) => rows.find((r) => r.kind === k)?.n ?? 0;
  return { newsletter: n("newsletter") + n("newsletter_top"), blog: n("launch_post") };
}

const listingColumns = {
  task: perkTasks,
  name: products.name,
  slug: products.slug,
  tagline: products.tagline,
  logoUrl: products.logoUrl,
  tier: products.tier,
  status: products.status,
  launchWeekKey: products.launchWeekKey,
};
export type PerkRow = {
  task: PerkTask;
  name: string;
  slug: string;
  tagline: string;
  logoUrl: string | null;
  tier: Product["tier"];
  status: Product["status"];
  launchWeekKey: string | null;
};

/** Newsletter mentions that haven't gone out yet, top slots first. */
export async function openMentions(): Promise<PerkRow[]> {
  return db()
    .select(listingColumns)
    .from(perkTasks)
    .innerJoin(products, eq(products.id, perkTasks.productId))
    .where(and(inArray(perkTasks.kind, ["newsletter", "newsletter_top"]), eq(perkTasks.status, "suggested")))
    .orderBy(desc(perkTasks.kind), asc(perkTasks.weekKey), asc(perkTasks.createdAt));
}

/** Mentions already handled (sent or skipped), newest issue first. */
export async function pastMentions(limit = 30): Promise<PerkRow[]> {
  return db()
    .select(listingColumns)
    .from(perkTasks)
    .innerJoin(products, eq(products.id, perkTasks.productId))
    .where(
      and(inArray(perkTasks.kind, ["newsletter", "newsletter_top"]), inArray(perkTasks.status, ["done", "skipped"])),
    )
    .orderBy(desc(perkTasks.weekKey), desc(perkTasks.doneAt))
    .limit(limit);
}

/**
 * Mentions that go in the issue for `closedWeek`: due by then and not yet
 * sent, for listings that are live by the time it goes out (the issue's
 * "Debuting now" week). Unreviewed ones are included as they are.
 */
export async function mentionsForIssue(closedWeek: string): Promise<PerkRow[]> {
  return db()
    .select(listingColumns)
    .from(perkTasks)
    .innerJoin(products, eq(products.id, perkTasks.productId))
    .where(
      and(
        inArray(perkTasks.kind, ["newsletter", "newsletter_top"]),
        eq(perkTasks.status, "suggested"),
        lte(perkTasks.weekKey, closedWeek),
        eq(products.status, "approved"),
        lte(products.launchWeekKey, addWeeks(closedWeek, 1)),
      ),
    )
    .orderBy(asc(perkTasks.createdAt));
}

/** After an issue goes out: its mentions are done, recorded against that issue. */
export async function markMentionsDelivered(taskIds: string[], issueWeek: string, now = new Date()) {
  if (taskIds.length === 0) return;
  await db()
    .update(perkTasks)
    .set({ status: "done", weekKey: issueWeek, doneAt: now })
    .where(and(inArray(perkTasks.id, taskIds), eq(perkTasks.status, "suggested")));
}

/** Launch posts still to write, soonest due first. */
export async function openLaunchPosts(): Promise<PerkRow[]> {
  return db()
    .select(listingColumns)
    .from(perkTasks)
    .innerJoin(products, eq(products.id, perkTasks.productId))
    .where(and(eq(perkTasks.kind, "launch_post"), inArray(perkTasks.status, ["suggested", "drafting"])))
    .orderBy(asc(perkTasks.dueAt), asc(perkTasks.createdAt));
}

export async function getPerkTask(id: string) {
  return db().query.perkTasks.findFirst({ where: eq(perkTasks.id, id) });
}

/** The newsletter line for a mention; empty goes back to the tagline. */
export async function setBlurb(id: string, blurb: string) {
  const text = blurb.trim().slice(0, 280);
  const [row] = await db()
    .update(perkTasks)
    .set({ blurb: text || null })
    .where(and(eq(perkTasks.id, id), eq(perkTasks.status, "suggested")))
    .returning();
  if (!row) throw new PerkError("This mention has already gone out or been skipped.");
  return row;
}

export async function skipPerk(id: string, reason: string) {
  const text = reason.trim().slice(0, 300);
  if (!text) throw new PerkError("Say why it's skipped.");
  const [row] = await db()
    .update(perkTasks)
    .set({ status: "skipped", skipReason: text })
    .where(and(eq(perkTasks.id, id), inArray(perkTasks.status, ["suggested", "drafting"])))
    .returning();
  if (!row) throw new PerkError("This perk is already done or skipped.");
  return row;
}

/** A launch draft was started for the task. */
export async function linkLaunchPost(taskId: string, postId: string) {
  await db()
    .update(perkTasks)
    .set({ status: "drafting", postId })
    .where(and(eq(perkTasks.id, taskId), eq(perkTasks.kind, "launch_post")));
}

/** Publishing a launch post delivers its perk; unpublishing reopens it. */
export async function onPostPublished(postId: string, published: boolean, now = new Date()) {
  await db()
    .update(perkTasks)
    .set(published ? { status: "done", doneAt: now } : { status: "drafting", doneAt: null })
    .where(and(eq(perkTasks.postId, postId), published ? ne(perkTasks.status, "done") : eq(perkTasks.status, "done")));
}

/** A deleted launch draft puts its perk back in the suggestions. */
export async function onPostDeleted(postId: string) {
  await db()
    .update(perkTasks)
    .set({ status: "suggested", postId: null, doneAt: null })
    .where(and(eq(perkTasks.postId, postId), ne(perkTasks.status, "skipped")));
}
