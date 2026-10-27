import "server-only";
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { env } from "@/env";
import { site } from "@/config/site";
import { sendEmail } from "@/lib/email";
import { entitled } from "@/lib/billing/entitlements";
import { domainOf } from "@/lib/slug";
import { createDrProvider, DR_DROP_ALERT, type DrProvider } from "./providers";

const { domainMetrics, products, subscriptions, submissionOrders, directories } = schema;
export type DomainMetric = typeof domainMetrics.$inferSelect;

const DAY = 86_400_000;
/** Snapshots are weekly; the DR checker reuses one this fresh. */
export const SNAPSHOT_EVERY_DAYS = 7;
const ts = (d: Date) => sql`${d.toISOString()}::timestamptz`;
const url = (path: string) => new URL(path, env().NEXT_PUBLIC_SITE_URL).toString();

let override: DrProvider | null | undefined;

/** The configured DR provider, or null (the features hide themselves). */
export function drProvider(): DrProvider | null {
  if (override !== undefined) return override;
  const { DR_PROVIDER, DR_API_KEY } = env();
  return DR_PROVIDER && DR_API_KEY ? createDrProvider(DR_PROVIDER, DR_API_KEY) : null;
}

export const drEnabled = () => drProvider() !== null;

/** Test-only. `undefined` goes back to the environment. */
export function setDrProviderForTests(p: DrProvider | null | undefined) {
  override = p;
}

/** Latest reading for a domain, if it's no older than `maxAgeDays`. */
export async function latestDr(domain: string, maxAgeDays = SNAPSHOT_EVERY_DAYS, now = new Date()) {
  return (
    (await db().query.domainMetrics.findFirst({
      where: and(
        eq(domainMetrics.domain, domain),
        gt(domainMetrics.measuredAt, ts(new Date(now.getTime() - maxAgeDays * DAY))),
      ),
      orderBy: desc(domainMetrics.measuredAt),
    })) ?? null
  );
}

/** Every reading for a domain, oldest first (charts). */
export async function drHistory(domain: string) {
  return db()
    .select({ at: domainMetrics.measuredAt, dr: domainMetrics.dr })
    .from(domainMetrics)
    .where(eq(domainMetrics.domain, domain))
    .orderBy(asc(domainMetrics.measuredAt))
    .limit(200);
}

/** Measures a domain now and stores it. Returns the reading and the one before it. */
export async function snapshot(domain: string, now = new Date()) {
  const provider = drProvider();
  if (!provider) return null;
  const previous =
    (await db().query.domainMetrics.findFirst({
      where: eq(domainMetrics.domain, domain),
      orderBy: desc(domainMetrics.measuredAt),
    })) ?? null;
  const reading = await provider.fetchDr(domain);
  const [row] = await db()
    .insert(domainMetrics)
    .values({ domain, ...reading, provider: provider.id, measuredAt: now })
    .returning();
  return { row, previous };
}

/** A cached reading (≤ 7 days old) or a fresh one. For the free DR checker. */
export async function drFor(domain: string, now = new Date()) {
  return (await latestDr(domain, SNAPSHOT_EVERY_DAYS, now)) ?? (await snapshot(domain, now))?.row ?? null;
}

/** A baseline at intake, so the order's chart starts before any listing goes live. Never throws. */
export async function baselineSnapshot(websiteUrl: string | null, now = new Date()) {
  if (!websiteUrl || !drEnabled()) return null;
  try {
    const domain = domainOf(websiteUrl);
    return (await latestDr(domain, 1, now)) ?? (await snapshot(domain, now))?.row ?? null;
  } catch (err) {
    console.error("DR baseline failed", err);
    return null;
  }
}

type Watcher = { email: string; href: string };

/** Domains we track weekly, and who hears about a drop: Maker Pro products and submission orders. */
async function trackedDomains(now: Date): Promise<Map<string, Watcher[]>> {
  const out = new Map<string, Watcher[]>();
  const add = (domain: string, w: Watcher) => {
    const list = out.get(domain) ?? [];
    if (!list.some((x) => x.email === w.email)) list.push(w);
    out.set(domain, list);
  };
  const pro = await db()
    .selectDistinct({ domain: products.domain, email: schema.user.email })
    .from(products)
    .innerJoin(subscriptions, eq(subscriptions.userId, products.createdBy))
    .innerJoin(schema.user, eq(schema.user.id, products.createdBy))
    .where(
      and(
        inArray(subscriptions.sku, ["sub_maker_pro_monthly", "sub_maker_pro_yearly"]),
        entitled(now),
        inArray(products.status, ["draft", "pending", "approved"]),
      ),
    );
  for (const r of pro) if (r.domain) add(r.domain, { email: r.email, href: url("/dashboard") });

  const orders = await db()
    .select({
      websiteUrl: submissionOrders.websiteUrl,
      email: sql<string>`coalesce(${submissionOrders.contactEmail}, ${submissionOrders.email})`,
      token: submissionOrders.intakeToken,
    })
    .from(submissionOrders)
    .where(
      and(
        inArray(submissionOrders.status, ["queued", "in_progress", "delivered"]),
        isNotNull(submissionOrders.websiteUrl),
      ),
    );
  for (const o of orders) {
    try {
      add(domainOf(o.websiteUrl!), { email: o.email, href: url(`/orders/${o.token}`) });
    } catch {
      // A malformed URL from intake: skip it.
    }
  }
  return out;
}

/**
 * Daily: snapshots tracked domains not measured in a week (bounded batch),
 * emails watchers when DR drops by DR_DROP_ALERT or more, then backfills
 * directories with no DR yet.
 */
export async function snapshotDomains(now = new Date(), { batch = 100, backfill = 50 } = {}) {
  if (!drEnabled()) return { skipped: "no DR provider configured" };
  const watched = await trackedDomains(now);
  const recent = new Set(
    (
      await db()
        .selectDistinct({ domain: domainMetrics.domain })
        .from(domainMetrics)
        .where(gt(domainMetrics.measuredAt, ts(new Date(now.getTime() - (SNAPSHOT_EVERY_DAYS - 0.5) * DAY))))
    ).map((r) => r.domain),
  );
  const due = [...watched.keys()].filter((d) => !recent.has(d)).slice(0, batch);

  let measured = 0;
  let alerts = 0;
  for (const domain of due) {
    try {
      const res = await snapshot(domain, now);
      if (!res) continue;
      measured++;
      const drop = res.previous ? res.previous.dr - res.row.dr : 0;
      if (drop >= DR_DROP_ALERT) {
        for (const w of watched.get(domain) ?? []) {
          const lines = [
            `The Domain Rating of ${domain} fell from ${res.previous!.dr} to ${res.row.dr} since our last check.`,
            "A drop like this usually means some sites that linked to you removed the link or lost authority themselves. Your Link Monitor shows which listings changed.",
          ];
          await sendEmail({
            to: w.email,
            subject: `DR alert: ${domain} dropped ${Math.round(drop)} points`,
            text: [...lines, `Details: ${w.href}`, `— ${site.name}`].join("\n\n"),
            html: `${lines.map((l) => `<p>${l}</p>`).join("")}<p><a href="${w.href}">See the details</a></p><p>— ${site.name}</p>`,
          });
          alerts++;
        }
      }
    } catch (err) {
      console.error(`DR snapshot ${domain}`, err);
    }
  }
  const backfilled = await backfillDirectoryDr(Math.max(0, backfill - measured));
  return { measured, alerts, backfilled };
}

/** Fills `directories.dr` where it's empty, a few a day. Staff-entered values are never overwritten. */
export async function backfillDirectoryDr(limit = 50) {
  if (limit === 0 || !drEnabled()) return 0;
  const empty = await db()
    .select({ id: directories.id, url: directories.url })
    .from(directories)
    .where(and(isNull(directories.dr), eq(directories.isActive, true)))
    .orderBy(asc(directories.name))
    .limit(limit);
  let filled = 0;
  for (const d of empty) {
    try {
      const reading = await drFor(domainOf(d.url));
      if (!reading) continue;
      await db()
        .update(directories)
        .set({ dr: Math.round(reading.dr) })
        .where(and(eq(directories.id, d.id), isNull(directories.dr)));
      filled++;
    } catch (err) {
      console.error(`DR backfill ${d.url}`, err);
    }
  }
  return filled;
}
