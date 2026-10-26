import "server-only";
import { and, asc, eq, isNotNull, lt } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db, schema } from "@/db";
import { env } from "@/env";
import { addImpressions, newsletterSponsor } from "@/lib/ads/service";
import { sendBatch, sendEmail } from "@/lib/email";
import { weekBoard } from "@/lib/board/queries";
import { addWeeks, formatWeekLabel, weekKeyFor } from "@/lib/weeks";
import { renderDigest, type DigestData } from "./render";

const { newsletterSubscribers: subs, newsletterIssues: issues, launchWeeks } = schema;

function url(path: string) {
  return new URL(path, env().NEXT_PUBLIC_SITE_URL).toString();
}

const newToken = () => randomBytes(24).toString("base64url");
const RESEND_CONFIRM_AFTER_MS = 10 * 60_000;

export type SubscribeResult = "confirm_sent" | "already_subscribed" | "recently_sent";

async function sendConfirm(email: string, token: string) {
  const link = url(`/newsletter/confirm?token=${token}`);
  await sendEmail({
    to: email,
    subject: "Confirm your DebutYard newsletter subscription",
    text: `Confirm your subscription to the weekly DebutYard digest:\n${link}\n\nIf you didn't ask for this, ignore this email.`,
    html: `<p>Confirm your subscription to the weekly DebutYard digest:</p><p><a href="${link}">Confirm subscription</a></p><p>If you didn't ask for this, ignore this email.</p>`,
  });
}

/** Double opt-in: creates (or revives) a pending subscriber and emails a confirm link. */
export async function subscribe(rawEmail: string, source: string | null = null): Promise<SubscribeResult> {
  const email = rawEmail.trim().toLowerCase();
  const existing = await db().query.newsletterSubscribers.findFirst({ where: eq(subs.email, email) });
  if (existing?.status === "active") return "already_subscribed";
  if (
    existing?.confirmEmailSentAt &&
    Date.now() - existing.confirmEmailSentAt.getTime() < RESEND_CONFIRM_AFTER_MS &&
    existing.status === "pending"
  ) {
    return "recently_sent";
  }

  const token = existing?.status === "pending" ? existing.token : newToken();
  if (existing) {
    await db()
      .update(subs)
      .set({ status: "pending", token, confirmEmailSentAt: new Date(), unsubscribedAt: null })
      .where(eq(subs.id, existing.id));
  } else {
    await db().insert(subs).values({ email, token, source, confirmEmailSentAt: new Date() }).onConflictDoNothing();
  }
  await sendConfirm(email, token);
  return "confirm_sent";
}

export async function confirmSubscription(token: string): Promise<boolean> {
  const [row] = await db()
    .update(subs)
    .set({ status: "active", confirmedAt: new Date() })
    .where(and(eq(subs.token, token), eq(subs.status, "pending")))
    .returning();
  if (row) return true;
  return Boolean(
    await db().query.newsletterSubscribers.findFirst({ where: and(eq(subs.token, token), eq(subs.status, "active")) }),
  );
}

export async function unsubscribe(token: string): Promise<boolean> {
  const [row] = await db()
    .update(subs)
    .set({ status: "unsubscribed", unsubscribedAt: new Date() })
    .where(eq(subs.token, token))
    .returning();
  return Boolean(row);
}

/** Digest for the week that just closed plus the week that just started. */
export async function buildDigest(closedWeek: string): Promise<DigestData> {
  const newWeek = addWeeks(closedWeek, 1);
  const [closedBoard, newBoard, awards] = await Promise.all([
    weekBoard(closedWeek),
    weekBoard(newWeek),
    db().query.awards.findMany({
      where: and(eq(schema.awards.scope, "week"), eq(schema.awards.periodKey, closedWeek)),
      orderBy: (a, { asc }) => asc(a.place),
    }),
  ]);
  const byId = new Map(closedBoard.map((p) => [p.id, p]));
  const winners = awards
    .map((a) => ({ a, p: byId.get(a.productId) }))
    .filter((x) => x.p)
    .map(({ a, p }) => ({
      name: p!.name,
      tagline: p!.tagline,
      url: url(`/p/${p!.slug}`),
      votes: p!.votes,
      place: a.place,
    }));
  const winnerIds = new Set(awards.map((a) => a.productId));

  const paidRank = { spotlight: 0, premium: 1, pro: 2 } as Record<string, number>;
  const debuting = [...newBoard]
    .sort((a, b) => (paidRank[a.tier] ?? 9) - (paidRank[b.tier] ?? 9))
    .slice(0, 10)
    .map((p) => ({ name: p.name, tagline: p.tagline, url: url(`/p/${p.slug}`), featured: p.tier in paidRank }));

  return {
    closedWeekLabel: formatWeekLabel(closedWeek),
    newWeekLabel: formatWeekLabel(newWeek),
    winners,
    topOfWeek: closedBoard
      .filter((p) => !winnerIds.has(p.id))
      .slice(0, 7)
      .map((p) => ({ name: p.name, tagline: p.tagline, url: url(`/p/${p.slug}`), votes: p.votes })),
    debutingNow: debuting,
    sponsor: await newsletterSponsor(newWeek),
    siteUrl: url("/"),
  };
}

/**
 * Sends the digest for last week once it's closed. The issue row is the lock;
 * a send that died midway is retried after an hour with the same idempotency
 * keys, so recipients who already got it don't get it twice.
 */
export async function sendWeeklyDigest(now = new Date()) {
  const closedWeek = addWeeks(weekKeyFor(now), -1);
  const week = await db().query.launchWeeks.findFirst({
    where: and(eq(launchWeeks.key, closedWeek), isNotNull(launchWeeks.closedAt)),
  });
  if (!week) return { skipped: "week not closed" };

  const data = await buildDigest(closedWeek);
  if (data.winners.length === 0 && data.debutingNow.length === 0 && data.topOfWeek.length === 0) {
    return { skipped: "nothing to send" };
  }

  const subject = renderDigest(data, "").subject;
  const [claimed] = await db()
    .insert(issues)
    .values({ weekKey: closedWeek, subject })
    .onConflictDoNothing()
    .returning();
  if (!claimed) {
    const stale = await db().query.newsletterIssues.findFirst({
      where: and(eq(issues.weekKey, closedWeek), lt(issues.startedAt, new Date(now.getTime() - 3600_000))),
    });
    if (!stale || stale.sentAt) return { skipped: "already sent or in progress" };
    await db().update(issues).set({ startedAt: now, error: null }).where(eq(issues.weekKey, closedWeek));
  }

  const recipients = await db()
    .select({ email: subs.email, token: subs.token })
    .from(subs)
    .where(eq(subs.status, "active"))
    .orderBy(asc(subs.createdAt), asc(subs.id));

  try {
    const emails = recipients.map((r) => {
      const unsub = url(`/newsletter/unsubscribe?token=${r.token}`);
      const oneClick = url(`/api/newsletter/unsubscribe?token=${r.token}`);
      return {
        to: r.email,
        ...renderDigest(data, unsub),
        headers: { "List-Unsubscribe": `<${oneClick}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
      };
    });
    const sent = emails.length ? await sendBatch(emails, `digest-${closedWeek}`) : 0;
    await db().update(issues).set({ sentAt: new Date(), recipients: sent }).where(eq(issues.weekKey, closedWeek));
    if (data.sponsor) await addImpressions(data.sponsor.bookingId, sent);
    return { week: closedWeek, sent };
  } catch (err) {
    await db()
      .update(issues)
      .set({ error: err instanceof Error ? err.message : String(err) })
      .where(eq(issues.weekKey, closedWeek));
    throw err;
  }
}

export async function subscriberCounts() {
  const rows = await db().select({ status: subs.status }).from(subs);
  return {
    active: rows.filter((r) => r.status === "active").length,
    pending: rows.filter((r) => r.status === "pending").length,
    unsubscribed: rows.filter((r) => r.status === "unsubscribed").length,
  };
}
