import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { env } from "@/env";
import { site } from "@/config/site";
import { sendEmail } from "@/lib/email";
import { formatPeriodLabel } from "@/lib/periods";
import { formatWeekLabel, formatWeekRange, weekKeyFor } from "@/lib/weeks";

type Product = typeof schema.products.$inferSelect;

function url(path: string) {
  return new URL(path, env().NEXT_PUBLIC_SITE_URL).toString();
}

function escape(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/** Plain paragraphs → matching text and HTML bodies. Links are given as [label](url). */
function compose(paragraphs: string[]) {
  const text = paragraphs.map((p) => p.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1: $2")).join("\n\n");
  const html = paragraphs
    .map((p) => `<p>${escape(p).replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')}</p>`)
    .join("");
  return { text: `${text}\n\n— ${site.name}`, html: `${html}<p>— ${site.name}</p>` };
}

async function makerEmail(p: Product): Promise<string | null> {
  const u = await db().query.user.findFirst({ where: eq(schema.user.id, p.createdBy), columns: { email: true } });
  return u?.email ?? null;
}

async function toMaker(p: Product, subject: string, paragraphs: string[]) {
  const to = await makerEmail(p);
  if (to) await sendEmail({ to, subject, ...compose(paragraphs) });
}

export async function notifyProductSubmitted(p: Product) {
  await sendEmail({
    to: env().ADMIN_EMAIL ?? site.supportEmail,
    subject: `Review: ${p.name} (${p.tier})`,
    ...compose([
      `${p.name}: ${p.tagline}`,
      `Website: ${p.websiteUrl}`,
      `[Open the review queue](${url("/admin/review")})`,
    ]),
  });
}

export async function notifyProductApproved(p: Product) {
  const week = p.launchWeekKey!;
  // Paid debuts go into the current week, so they're live now.
  const liveNow = week <= weekKeyFor(new Date());
  await toMaker(p, liveNow ? `${p.name} is approved and live` : `${p.name} is approved for ${formatWeekLabel(week)}`, [
    liveNow
      ? `Good news: ${p.name} is approved and live now on this week's board (${formatWeekRange(week)}). Voting runs until Sunday at 23:59 UTC.`
      : `Good news: ${p.name} is approved and debuts in ${formatWeekLabel(week)} (${formatWeekRange(week)}). Voting opens Monday at 00:00 UTC and runs all week.`,
    p.tier === "free"
      ? `To keep a followed (dofollow) link from your listing, add the DebutYard badge to your homepage. Your snippet and a one-click check are in your [dashboard](${url("/dashboard")}).`
      : `Your paid debut includes a followed link, no badge needed.`,
    `Your listing: [${url(`/p/${p.slug}`)}](${url(`/p/${p.slug}`)})`,
  ]);
}

export async function notifyProductRejected(p: Product, refunded: boolean) {
  await toMaker(p, `About your DebutYard submission: ${p.name}`, [
    `Thanks for submitting ${p.name}. We couldn't approve it this time.`,
    `Reason: ${p.rejectionReason ?? "It doesn't meet our listing guidelines."}`,
    refunded
      ? "Under our money-back guarantee, we've refunded your payment in full. It can take a few business days to appear."
      : `You can update the listing and resubmit from your [dashboard](${url("/dashboard")}).`,
  ]);
}

export async function notifyPaidTierApplied(p: Product, tierLabel: string) {
  await toMaker(p, `${tierLabel} confirmed for ${p.name}`, [
    `Payment received: ${p.name} now has ${tierLabel}.`,
    p.status === "approved" && p.launchWeekKey
      ? p.launchWeekKey <= weekKeyFor(new Date())
        ? "It's live now on this week's board."
        : `It's scheduled for ${formatWeekLabel(p.launchWeekKey)} (${formatWeekRange(p.launchWeekKey)}).`
      : "We review new listings within 24 hours. It goes live the moment it's approved, and we'll email you then.",
    `Track it in your [dashboard](${url("/dashboard")}).`,
  ]);
}

export async function notifyWinner(p: Product, place: number, weekKey: string) {
  const medal = ["", "🥇 #1", "🥈 #2", "🥉 #3"][place] ?? `#${place}`;
  await toMaker(p, `${medal} Debut of the Week: ${p.name}`, [
    `Congratulations! ${p.name} finished ${medal} in ${formatWeekLabel(weekKey)} on DebutYard.`,
    "Your listing now keeps a followed link permanently, badge or not.",
    `Show it off: your winner badge snippet is in your [dashboard](${url("/dashboard")}).`,
  ]);
}

export async function notifyPeriodWinner(p: Product, place: number, scope: "month" | "year", key: string) {
  const medal = ["", "🥇 #1", "🥈 #2", "🥉 #3"][place] ?? `#${place}`;
  const title = scope === "month" ? "Debut of the Month" : "Debut of the Year";
  const label = formatPeriodLabel(scope, key);
  await toMaker(p, `${medal} ${title}: ${p.name}`, [
    `${p.name} finished ${medal} among every product that debuted on DebutYard in ${label}.`,
    `It now shows on your listing and on the [${label} board](${url(`/${scope}/${key}`)}).`,
  ]);
}

export async function notifyBadgeMissing(p: Product, graceUntil: Date) {
  await toMaker(p, `Your DebutYard badge is missing on ${p.domain}`, [
    `Our weekly check couldn't find the DebutYard badge on ${p.websiteUrl}.`,
    `If it's not back by ${graceUntil.toUTCString().slice(0, 16)}, the link from your listing switches to nofollow. It switches back as soon as the badge returns.`,
    `Snippet and re-check: [dashboard](${url("/dashboard")}).`,
  ]);
}

/** Paid-tier perks that are delivered by hand: a to-do for the team. */
const MANUAL_PERKS: Record<string, string[]> = {
  fast_track: [],
  pro: ["Include in this week's newsletter"],
  premium: ["Include in this week's newsletter", "Post on X, LinkedIn and Bluesky", "Write the launch post (blog)"],
  spotlight: ["Top newsletter slot", "Post on X, LinkedIn and Bluesky", "Write the launch post (blog)"],
};

export async function notifyAdminPaidTier(p: Product, tier: string) {
  const todo = MANUAL_PERKS[tier] ?? [];
  if (todo.length === 0) return;
  await sendEmail({
    to: env().ADMIN_EMAIL ?? site.supportEmail,
    subject: `To do for ${p.name} (${tier})`,
    ...compose([
      `${p.name} bought ${tier}. These perks are delivered by hand:`,
      ...todo.map((t) => `• ${t}`),
      `Listing: [${url(`/p/${p.slug}`)}](${url(`/p/${p.slug}`)})`,
    ]),
  });
}

export async function notifyRecapDrafted(post: { id: string; title: string }) {
  await sendEmail({
    to: env().ADMIN_EMAIL ?? site.supportEmail,
    subject: `Recap draft ready: ${post.title}`,
    ...compose([
      "The weekly recap is drafted from last week's board. Add a line about each winner, then publish.",
      `[Edit the draft](${url(`/admin/blog/${post.id}`)})`,
    ]),
  });
}
