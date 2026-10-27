import "server-only";
import { and, desc, eq, gt, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { env } from "@/env";
import { site } from "@/config/site";
import { sendEmail } from "@/lib/email";
import { startCheckout } from "@/lib/payments/service";
import { formatUsd } from "@/lib/payments/skus";
import type { ProviderId } from "@/lib/payments/types";
import { can } from "@/lib/billing/entitlements";
import { PRO_EXTRA_WEEKS } from "@/lib/billing/plans";
import { withRef } from "@/lib/board/links";
import { addWeeks, formatWeekLabel, formatWeekRange, upcomingWeekKeys, weekBounds, weekKeyFor } from "@/lib/weeks";
import {
  BOOKING_HORIZON_WEEKS,
  cpcCents,
  HOLD_MINUTES,
  PLACEMENTS,
  remainingByWeek,
  shouldExtend,
  WEEKS_PER,
  type Duration,
  type Placement,
} from "./placements";

const { adBookings, products, orders } = schema;
export type Booking = typeof adBookings.$inferSelect;

export class BookingError extends Error {}

const WEEK_MS = 7 * 86_400_000;

/** Bookings that use inventory: paid ones and unexpired holds. */
const holdsInventory = (now: Date) =>
  or(eq(adBookings.status, "active"), and(eq(adBookings.status, "held"), gt(adBookings.heldUntil, now)));

const sameSlot = (placement: Placement, categorySlug: string | null) =>
  and(
    eq(adBookings.placement, placement),
    placement === "category" && categorySlug ? eq(adBookings.categorySlug, categorySlug) : sql`true`,
  );

/**
 * Weeks that can be booked: whole weeks from next Monday on, so nobody pays
 * for a week that's half over. For newsletters the week is the issue that
 * goes out on its Monday. Maker Pro books `PRO_EXTRA_WEEKS` further ahead.
 */
export function bookableWeeks(now = new Date(), extraWeeks = 0): string[] {
  return upcomingWeekKeys(now, BOOKING_HORIZON_WEEKS + extraWeeks);
}

/** Extra weeks of booking horizon for this user's plan. */
export async function extraWeeksFor(userId: string, now = new Date()) {
  return (await can(userId, "early_booking", now)) ? PRO_EXTRA_WEEKS : 0;
}

export async function availability(
  placement: Placement,
  categorySlug: string | null,
  now = new Date(),
  extraWeeks = 0,
) {
  const keys = bookableWeeks(now, extraWeeks);
  const weeks = keys.map((key) => ({ key, ...weekBounds(key) }));
  const from = weeks[0].startsAt;
  const to = weeks[weeks.length - 1].endsAt;
  const live = await db()
    .select({ startsAt: adBookings.startsAt, paidEndsAt: adBookings.paidEndsAt })
    .from(adBookings)
    .where(
      and(
        sameSlot(placement, categorySlug),
        holdsInventory(now),
        lt(adBookings.startsAt, to),
        gt(adBookings.paidEndsAt, from),
      ),
    );
  const remaining = remainingByWeek(weeks, live, PLACEMENTS[placement].cap);
  return weeks.map((w) => ({
    key: w.key,
    label: formatWeekLabel(w.key),
    range: formatWeekRange(w.key),
    remaining: remaining[w.key],
  }));
}

export type BookInput = {
  userId: string;
  email: string;
  placement: Placement;
  duration: Duration;
  productId: string;
  categorySlug: string | null;
  weekKey: string;
  provider: ProviderId;
  couponCode?: string | null;
};

/** Reserves the slot (serialised per placement) and starts checkout. */
export async function bookSlot(input: BookInput, now = new Date()): Promise<{ bookingId: string; url: string }> {
  const config = PLACEMENTS[input.placement];
  const skuId = config.skus[input.duration];
  if (!skuId) throw new BookingError("That duration isn't available for this placement.");
  if (!bookableWeeks(now, await extraWeeksFor(input.userId, now)).includes(input.weekKey)) {
    throw new BookingError("Pick a week from the calendar.");
  }
  if (input.placement === "category" && !input.categorySlug) throw new BookingError("Pick a category to sponsor.");
  const categorySlug = input.placement === "category" ? input.categorySlug : null;

  const product = await db().query.products.findFirst({
    where: and(eq(products.id, input.productId), eq(products.createdBy, input.userId)),
    columns: { id: true, status: true },
  });
  if (!product) throw new BookingError("Pick one of your listings to promote.");
  if (product.status !== "approved") throw new BookingError("Only approved listings can be promoted.");
  if (categorySlug && !(await db().query.categories.findFirst({ where: eq(schema.categories.slug, categorySlug) }))) {
    throw new BookingError("Unknown category.");
  }

  const weeks = WEEKS_PER[input.duration];
  const startsAt = weekBounds(input.weekKey).startsAt;
  const paidEndsAt = new Date(startsAt.getTime() + weeks * WEEK_MS);

  const booking = await db().transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`ads:${input.placement}:${categorySlug ?? ""}`}))`);
    const overlapping = await tx
      .select({ startsAt: adBookings.startsAt, paidEndsAt: adBookings.paidEndsAt })
      .from(adBookings)
      .where(
        and(
          sameSlot(input.placement, categorySlug),
          holdsInventory(now),
          lt(adBookings.startsAt, paidEndsAt),
          gt(adBookings.paidEndsAt, startsAt),
        ),
      );
    const covered = Array.from({ length: weeks }, (_, i) => {
      const key = addWeeks(input.weekKey, i);
      return { key, ...weekBounds(key) };
    });
    const remaining = remainingByWeek(covered, overlapping, config.cap);
    const full = covered.find((w) => remaining[w.key] === 0);
    if (full) throw new BookingError(`${formatWeekLabel(full.key)} is sold out for this placement.`);

    const [row] = await tx
      .insert(adBookings)
      .values({
        placement: input.placement,
        categorySlug,
        productId: input.productId,
        userId: input.userId,
        sku: skuId,
        weekKey: input.weekKey,
        weeks,
        status: "held",
        heldUntil: new Date(now.getTime() + HOLD_MINUTES * 60_000),
        startsAt,
        paidEndsAt,
        endsAt: paidEndsAt,
      })
      .returning();
    return row;
  });

  try {
    const { orderId, url } = await startCheckout({
      skuId,
      provider: input.provider,
      email: input.email,
      userId: input.userId,
      couponCode: input.couponCode ?? null,
      metadata: { bookingId: booking.id },
    });
    await db().update(adBookings).set({ orderId }).where(eq(adBookings.id, booking.id));
    return { bookingId: booking.id, url };
  } catch (err) {
    await db().update(adBookings).set({ status: "cancelled" }).where(eq(adBookings.id, booking.id));
    throw err;
  }
}

/**
 * Payment fulfilment: the hold becomes an active booking. A payment that lands
 * after its hold lapsed still activates (we honour paid orders) and the team
 * is told in case that overfills the week.
 */
export async function activateBooking(bookingId: string, now = new Date()) {
  const before = await db().query.adBookings.findFirst({ where: eq(adBookings.id, bookingId) });
  if (!before) throw new Error(`Booking ${bookingId} not found`);
  if (before.status === "active" || before.status === "completed") return before;
  const lapsed = before.status === "cancelled" || (before.heldUntil !== null && before.heldUntil <= now);
  const [row] = await db()
    .update(adBookings)
    .set({ status: "active", heldUntil: null })
    .where(eq(adBookings.id, bookingId))
    .returning();

  const product = await db().query.products.findFirst({ where: eq(products.id, row.productId) });
  const label = PLACEMENTS[row.placement].label;
  const when = row.weeks > 1 ? `${formatWeekLabel(row.weekKey)} for ${row.weeks} weeks` : formatWeekLabel(row.weekKey);
  const owner = row.userId ? await db().query.user.findFirst({ where: eq(schema.user.id, row.userId) }) : null;
  if (owner) {
    const dash = new URL("/dashboard", env().NEXT_PUBLIC_SITE_URL).toString();
    await sendEmail({
      to: owner.email,
      subject: `Booked: ${label} for ${product?.name ?? "your listing"}`,
      text: `Your ${label} for ${product?.name} is booked for ${when}.\n\nImpressions and clicks show on your dashboard: ${dash}\n\n— ${site.name}`,
      html: `<p>Your ${label} for <strong>${product?.name}</strong> is booked for ${when}.</p><p>Impressions and clicks show on your <a href="${dash}">dashboard</a>.</p><p>— ${site.name}</p>`,
    });
  }
  if (lapsed) {
    await sendEmail({
      to: env().ADMIN_EMAIL ?? site.supportEmail,
      subject: `Check inventory: late payment for ${label} (${formatWeekLabel(row.weekKey)})`,
      text: `Booking ${row.id} was paid after its hold lapsed and is now active. Check the week isn't over capacity.`,
      html: `<p>Booking <code>${row.id}</code> was paid after its hold lapsed and is now active. Check the week isn't over capacity.</p>`,
    });
  }
  return row;
}

export type AdItem = {
  bookingId: string | null;
  placement: Placement;
  slug: string;
  name: string;
  tagline: string;
  logoUrl: string | null;
  /** Click-through URL (tracked for bookings). */
  href: string;
};

/** Active bookings showing right now in a placement. */
export async function liveAds(
  placement: Placement,
  opts: { categorySlug?: string; now?: Date } = {},
): Promise<AdItem[]> {
  const now = opts.now ?? new Date();
  const rows = await db()
    .select({
      id: adBookings.id,
      placement: adBookings.placement,
      slug: products.slug,
      name: products.name,
      tagline: products.tagline,
      logoUrl: products.logoUrl,
    })
    .from(adBookings)
    .innerJoin(products, eq(products.id, adBookings.productId))
    .where(
      and(
        eq(adBookings.placement, placement),
        opts.categorySlug ? eq(adBookings.categorySlug, opts.categorySlug) : sql`true`,
        eq(adBookings.status, "active"),
        lte(adBookings.startsAt, now),
        gt(adBookings.endsAt, now),
        eq(products.status, "approved"),
      ),
    )
    .orderBy(adBookings.createdAt);
  return rows.map((r) => ({
    bookingId: r.id,
    placement: r.placement,
    slug: r.slug,
    name: r.name,
    tagline: r.tagline,
    logoUrl: r.logoUrl,
    href: `/api/ads/${r.id}/click`,
  }));
}

/** Newsletter sponsor for the issue sent on `weekKey`'s Monday. */
export async function newsletterSponsor(weekKey: string) {
  const { startsAt } = weekBounds(weekKey);
  const [ad] = await liveAds("newsletter", { now: new Date(startsAt.getTime() + 60_000) });
  if (!ad?.bookingId) return null;
  return {
    bookingId: ad.bookingId,
    name: ad.name,
    tagline: ad.tagline,
    url: new URL(ad.href, env().NEXT_PUBLIC_SITE_URL).toString(),
  };
}

/** A sent issue counts each delivered email as one impression for its sponsor. */
export async function addImpressions(bookingId: string, n: number) {
  if (n <= 0) return;
  await db()
    .update(adBookings)
    .set({ impressions: sql`${adBookings.impressions} + ${n}` })
    .where(eq(adBookings.id, bookingId));
}

const BOTS = /bot|crawler|spider|preview|fetch|curl|wget|headless/i;
export const isBot = (ua: string | null) => BOTS.test(ua ?? "");

export async function recordImpressions(ids: string[]) {
  if (ids.length === 0) return;
  await db()
    .update(adBookings)
    .set({ impressions: sql`${adBookings.impressions} + 1` })
    .where(and(inArray(adBookings.id, ids), eq(adBookings.status, "active")));
}

/** Counts a click and returns where to send the visitor. */
export async function recordClick(bookingId: string, count: boolean): Promise<string | null> {
  const [row] = count
    ? await db()
        .update(adBookings)
        .set({ clicks: sql`${adBookings.clicks} + 1` })
        .where(eq(adBookings.id, bookingId))
        .returning({ productId: adBookings.productId })
    : await db().select({ productId: adBookings.productId }).from(adBookings).where(eq(adBookings.id, bookingId));
  if (!row) return null;
  const p = await db().query.products.findFirst({
    where: eq(products.id, row.productId),
    columns: { websiteUrl: true },
  });
  return p ? withRef(p.websiteUrl) : null;
}

/**
 * Daily: ends slots whose time is up. Under the CPC guarantee a slot still
 * costing over $1 a click runs another week for free; otherwise it completes
 * and the buyer gets a performance report. Also releases lapsed holds.
 */
export async function settleBookings(now = new Date()) {
  await db()
    .update(adBookings)
    .set({ status: "cancelled" })
    .where(and(eq(adBookings.status, "held"), lt(adBookings.heldUntil, new Date(now.getTime() - 24 * 3600_000))));

  const due = await db()
    .select({ b: adBookings, paidCents: orders.amountCents, productName: products.name })
    .from(adBookings)
    .innerJoin(products, eq(products.id, adBookings.productId))
    .leftJoin(orders, eq(orders.id, adBookings.orderId))
    .where(and(eq(adBookings.status, "active"), lte(adBookings.endsAt, now), isNull(adBookings.settledAt)));

  const result = { extended: 0, completed: 0 };
  for (const { b, paidCents, productName } of due) {
    const paid = paidCents ?? 0;
    if (shouldExtend({ placement: b.placement, paidCents: paid, clicks: b.clicks, extensions: b.extensions })) {
      await db()
        .update(adBookings)
        .set({ endsAt: new Date(b.endsAt.getTime() + WEEK_MS), extensions: b.extensions + 1 })
        .where(and(eq(adBookings.id, b.id), eq(adBookings.endsAt, b.endsAt)));
      result.extended++;
      continue;
    }
    const [done] = await db()
      .update(adBookings)
      .set({ status: "completed", settledAt: now })
      .where(and(eq(adBookings.id, b.id), isNull(adBookings.settledAt)))
      .returning();
    if (!done) continue;
    result.completed++;
    const owner = b.userId ? await db().query.user.findFirst({ where: eq(schema.user.id, b.userId) }) : null;
    if (owner)
      await sendReport(owner.email, done, productName, paid).catch((err) => console.error("ad report failed", err));
  }
  return result;
}

async function sendReport(to: string, b: Booking, productName: string, paidCents: number) {
  const label = PLACEMENTS[b.placement].label;
  const cpc = cpcCents(paidCents, b.clicks);
  const lines = [
    `Your ${label} for ${productName} has finished.`,
    `Impressions: ${b.impressions}. Clicks: ${b.clicks}.${cpc !== null && paidCents > 0 ? ` Cost per click: ${formatUsd(cpc)}.` : ""}`,
    b.extensions > 0
      ? `Our CPC guarantee kept it up ${b.extensions} extra week${b.extensions === 1 ? "" : "s"} for free.`
      : "",
    `Book again any time: ${new URL("/advertise", env().NEXT_PUBLIC_SITE_URL)}`,
  ].filter(Boolean);
  await sendEmail({
    to,
    subject: `Your ${label} results: ${b.clicks} click${b.clicks === 1 ? "" : "s"}`,
    text: `${lines.join("\n\n")}\n\n— ${site.name}`,
    html: `${lines.map((l) => `<p>${l}</p>`).join("")}<p>— ${site.name}</p>`,
  });
}

export async function bookingsForUser(userId: string) {
  return db()
    .select({ b: adBookings, productName: products.name, paidCents: orders.amountCents })
    .from(adBookings)
    .innerJoin(products, eq(products.id, adBookings.productId))
    .leftJoin(orders, eq(orders.id, adBookings.orderId))
    .where(and(eq(adBookings.userId, userId), inArray(adBookings.status, ["active", "completed"])))
    .orderBy(desc(adBookings.startsAt));
}

export async function allBookings(now = new Date()) {
  const from = weekBounds(addWeeks(weekKeyFor(now), -4)).startsAt;
  return db()
    .select({ b: adBookings, productName: products.name, paidCents: orders.amountCents, email: orders.email })
    .from(adBookings)
    .innerJoin(products, eq(products.id, adBookings.productId))
    .leftJoin(orders, eq(orders.id, adBookings.orderId))
    .where(and(gt(adBookings.endsAt, from), inArray(adBookings.status, ["held", "active", "completed"])))
    .orderBy(adBookings.startsAt);
}
