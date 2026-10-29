// AFFILIATES PAUSED. The affiliate program is switched off for now, not
// deleted: everything below is commented out so it can be restored as is.
// To turn it back on, uncomment the files listed in src/lib/affiliates/PAUSED.md
// and the call sites marked "Affiliates are paused".

// import "server-only";
// import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
// import { z } from "zod";
// import { db, schema } from "@/db";
// import { randomSuffix, slugify } from "@/lib/slug";
// import { APPROVE_AFTER_DAYS, COMMISSIONED_KINDS, commissionCents, isAffiliateCode } from "./rules";
//
// const { affiliates, affiliateReferrals: referrals, orders } = schema;
// export type Affiliate = typeof affiliates.$inferSelect;
// type Order = typeof orders.$inferSelect;
//
// export class AffiliateError extends Error {}
//
// const DAY = 86_400_000;
//
// export const joinInput = z.object({
//   payoutEmail: z.string().trim().email("Add the PayPal email we should pay").max(200),
//   acceptTerms: z.literal(true, { message: "Please accept the affiliate terms." }),
// });
//
// export async function affiliateFor(userId: string) {
//   return (await db().query.affiliates.findFirst({ where: eq(affiliates.userId, userId) })) ?? null;
// }
//
// /** Joins the program with a code made from the user's handle or name. */
// export async function joinAffiliate(userId: string, raw: z.input<typeof joinInput>) {
//   const input = joinInput.parse(raw);
//   const existing = await affiliateFor(userId);
//   if (existing) return existing;
//   const u = await db().query.user.findFirst({ where: eq(schema.user.id, userId) });
//   if (!u) throw new AffiliateError("Sign in first.");
//   const base = slugify(u.handle ?? u.name ?? "maker", 24) || "maker";
//   for (const candidate of [base, `${base}-${randomSuffix()}`, `${base}-${randomSuffix(6)}`]) {
//     if (!isAffiliateCode(candidate)) continue;
//     const [row] = await db()
//       .insert(affiliates)
//       .values({ userId, code: candidate, payoutEmail: input.payoutEmail })
//       .onConflictDoNothing()
//       .returning();
//     if (row) return row;
//     const mine = await affiliateFor(userId);
//     if (mine) return mine;
//   }
//   throw new AffiliateError("Couldn't create your affiliate code. Please try again.");
// }
//
// export async function updatePayoutEmail(userId: string, payoutEmail: string) {
//   const email = z.string().trim().email().max(200).parse(payoutEmail);
//   await db().update(affiliates).set({ payoutEmail: email }).where(eq(affiliates.userId, userId));
// }
//
// /**
//  * Fulfilment hook: a commission for a paid order that came through an
//  * affiliate link (the code is in the order's metadata). One per order; no
//  * self-referrals; only commissioned kinds.
//  */
// export async function recordReferral(order: Order) {
//   const via = order.metadata.via;
//   if (!isAffiliateCode(via) || !(COMMISSIONED_KINDS as readonly string[]).includes(order.kind)) return null;
//   const aff = await db()
//     .select({ a: affiliates, email: schema.user.email })
//     .from(affiliates)
//     .innerJoin(schema.user, eq(schema.user.id, affiliates.userId))
//     .where(and(eq(affiliates.code, via), eq(affiliates.status, "active")))
//     .then((r) => r[0]);
//   if (!aff) return null;
//   if (aff.a.userId === order.userId || aff.email.toLowerCase() === order.email.toLowerCase()) return null;
//   const [row] = await db()
//     .insert(referrals)
//     .values({
//       affiliateId: aff.a.id,
//       orderId: order.id,
//       commissionCents: commissionCents(order.amountCents, aff.a.ratePct),
//     })
//     .onConflictDoNothing()
//     .returning();
//   return row ?? null;
// }
//
// /** After a refund: a full one voids the commission, a partial one shrinks it. Paid-out ones are left. */
// export async function adjustReferralForRefund(orderId: string, refundedCents: number, full: boolean) {
//   const r = await db()
//     .select({ ref: referrals, rate: affiliates.ratePct, amount: orders.amountCents })
//     .from(referrals)
//     .innerJoin(affiliates, eq(affiliates.id, referrals.affiliateId))
//     .innerJoin(orders, eq(orders.id, referrals.orderId))
//     .where(and(eq(referrals.orderId, orderId), inArray(referrals.status, ["pending", "approved"])))
//     .then((rows) => rows[0]);
//   if (!r) return;
//   await db()
//     .update(referrals)
//     .set(
//       full ? { status: "void" } : { commissionCents: commissionCents(Math.max(0, r.amount - refundedCents), r.rate) },
//     )
//     .where(eq(referrals.id, r.ref.id));
// }
//
// /** Daily: approves commissions older than the refund window whose order is still paid. */
// export async function approveReferrals(now = new Date()) {
//   const cutoff = new Date(now.getTime() - APPROVE_AFTER_DAYS * DAY).toISOString();
//   const rows = await db()
//     .update(referrals)
//     .set({ status: "approved", approvedAt: now })
//     .where(
//       and(
//         eq(referrals.status, "pending"),
//         lt(referrals.createdAt, sql`${cutoff}::timestamptz`),
//         sql`exists (select 1 from orders o where o.id = ${referrals.orderId} and o.status in ('paid', 'partially_refunded'))`,
//       ),
//     )
//     .returning({ id: referrals.id });
//   return { approved: rows.length };
// }
//
// export type AffiliateStats = { referrals: number; pendingCents: number; approvedCents: number; paidCents: number };
//
// /** An affiliate's referrals (newest first) and totals by status. */
// export async function referralsFor(affiliateId: string) {
//   const rows = await db()
//     .select({ r: referrals, sku: orders.sku, paidAt: orders.paidAt })
//     .from(referrals)
//     .innerJoin(orders, eq(orders.id, referrals.orderId))
//     .where(eq(referrals.affiliateId, affiliateId))
//     .orderBy(desc(referrals.createdAt));
//   const sum = (st: string) => rows.filter((x) => x.r.status === st).reduce((n, x) => n + x.r.commissionCents, 0);
//   const stats: AffiliateStats = {
//     referrals: rows.filter((x) => x.r.status !== "void").length,
//     pendingCents: sum("pending"),
//     approvedCents: sum("approved"),
//     paidCents: sum("paid"),
//   };
//   return { rows, stats };
// }
//
// // --- Admin -------------------------------------------------------------------
//
// /** Every affiliate with what we owe them (approved, unpaid). */
// export async function listAffiliates() {
//   return db()
//     .select({
//       a: affiliates,
//       name: schema.user.name,
//       email: schema.user.email,
//       owedCents: sql<number>`coalesce((select sum(r.commission_cents) from affiliate_referrals r where r.affiliate_id = ${affiliates.id} and r.status = 'approved'), 0)::int`,
//       pendingCents: sql<number>`coalesce((select sum(r.commission_cents) from affiliate_referrals r where r.affiliate_id = ${affiliates.id} and r.status = 'pending'), 0)::int`,
//       paidCents: sql<number>`coalesce((select sum(r.commission_cents) from affiliate_referrals r where r.affiliate_id = ${affiliates.id} and r.status = 'paid'), 0)::int`,
//     })
//     .from(affiliates)
//     .innerJoin(schema.user, eq(schema.user.id, affiliates.userId))
//     .orderBy(desc(affiliates.createdAt));
// }
//
// /** Recent referrals across affiliates, for the admin page. */
// export async function listReferrals(limit = 200) {
//   return db()
//     .select({ r: referrals, code: affiliates.code, sku: orders.sku, amountCents: orders.amountCents })
//     .from(referrals)
//     .innerJoin(affiliates, eq(affiliates.id, referrals.affiliateId))
//     .innerJoin(orders, eq(orders.id, referrals.orderId))
//     .orderBy(desc(referrals.createdAt))
//     .limit(limit);
// }
//
// /** Staff approve a pending commission early (e.g. the order was delivered and can't be refunded). */
// export async function approveReferral(id: string, now = new Date()) {
//   const [row] = await db()
//     .update(referrals)
//     .set({ status: "approved", approvedAt: now })
//     .where(and(eq(referrals.id, id), eq(referrals.status, "pending")))
//     .returning();
//   if (!row) throw new AffiliateError("Only pending commissions can be approved.");
//   return row;
// }
//
// /** After paying an affiliate by PayPal: marks all their approved commissions paid. */
// export async function markAffiliatePaid(affiliateId: string, now = new Date()) {
//   const rows = await db()
//     .update(referrals)
//     .set({ status: "paid", paidAt: now })
//     .where(and(eq(referrals.affiliateId, affiliateId), eq(referrals.status, "approved")))
//     .returning({ cents: referrals.commissionCents });
//   return { count: rows.length, cents: rows.reduce((n, r) => n + r.cents, 0) };
// }
//
// export async function setAffiliateStatus(affiliateId: string, status: "active" | "suspended") {
//   await db().update(affiliates).set({ status }).where(eq(affiliates.id, affiliateId));
// }

export {};
