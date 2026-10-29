// AFFILIATES PAUSED. The affiliate program is switched off for now, not
// deleted: everything below is commented out so it can be restored as is.
// To turn it back on, uncomment the files listed in src/lib/affiliates/PAUSED.md
// and the call sites marked "Affiliates are paused".

// /**
//  * Affiliate commissions against a real Postgres with a fake payment provider:
//  * recorded once per paid order, never for self-referrals, shrunk or voided by
//  * refunds, approved after the refund window and marked paid by staff.
//  * Runs when TEST_DATABASE_URL is set; the database is wiped.
//  */
// import { eq, sql } from "drizzle-orm";
// import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
// import type { PaymentProvider, VerifiedPayment, WebhookEvent } from "@/lib/payments/types";
// import { resetDatabase } from "./helpers/db";
//
// const TEST_DB = process.env.TEST_DATABASE_URL;
// const DAY = 86_400_000;
//
// vi.mock("@/lib/email", () => ({
//   sendEmail: vi.fn(async () => {}),
//   sendBatch: vi.fn(async (emails: unknown[]) => emails.length),
// }));
//
// class FakePayments implements PaymentProvider {
//   readonly id = "paystack" as const;
//   verifyResult: VerifiedPayment | null = null;
//   async createCheckout(req: { orderId: string }) {
//     return { url: `https://pay.test/${req.orderId}`, providerRef: `ref-${req.orderId}` };
//   }
//   async verifyPayment(ref: string): Promise<VerifiedPayment> {
//     return this.verifyResult ?? { status: "pending", providerRef: ref };
//   }
//   async refund() {
//     return { providerRef: "rf" };
//   }
//   async createPlan() {
//     return { planId: "PLN" };
//   }
//   async createSubscription() {
//     return { url: "https://pay.test/sub" };
//   }
//   async cancelSubscription() {}
//   async getSubscription() {
//     return { status: "active" as const };
//   }
//   async parseWebhook(): Promise<WebhookEvent> {
//     throw new Error("unused");
//   }
// }
//
// describe.skipIf(!TEST_DB)("affiliates (Postgres)", () => {
//   const pay = new FakePayments();
//   let dbmod: typeof import("@/db");
//   let aff: typeof import("@/lib/affiliates/service");
//   let payments: typeof import("@/lib/payments/service");
//
//   beforeAll(async () => {
//     process.env.DATABASE_URL = TEST_DB;
//     process.env.NEXT_PUBLIC_SITE_URL = "https://debutyard.test";
//     process.env.ADMIN_EMAIL = "ops@debutyard.test";
//     await resetDatabase(TEST_DB!);
//     (await import("@/lib/payments")).setProviderForTests("paystack", pay);
//     dbmod = await import("@/db");
//     aff = await import("@/lib/affiliates/service");
//     payments = await import("@/lib/payments/service");
//   });
//
//   afterAll(async () => {
//     await (dbmod?.db() as unknown as { $client: { end(): Promise<void> } } | undefined)?.$client.end();
//   });
//
//   beforeEach(async () => {
//     await dbmod.db().execute(sql`truncate orders, affiliates, affiliate_referrals, refunds, "user" cascade`);
//     await dbmod
//       .db()
//       .insert(dbmod.schema.user)
//       .values({ id: "ref", name: "Ref Erer", email: "ref@x.test", handle: "referer" });
//   });
//
//   async function buy(email: string, via: string | null, skuId = "submission_starter") {
//     const { orderId } = await payments.startCheckout({
//       skuId,
//       provider: "paystack",
//       email,
//       metadata: via ? { via } : undefined,
//     });
//     const o = (await dbmod.db().query.orders.findFirst({ where: eq(dbmod.schema.orders.id, orderId) }))!;
//     pay.verifyResult = {
//       status: "paid",
//       providerRef: `ref-${orderId}`,
//       orderId,
//       amountCents: o.amountCents,
//       currency: "USD",
//     };
//     await payments.confirmPayment("paystack", `ref-${orderId}`);
//     return o;
//   }
//
//   const referralFor = (orderId: string) =>
//     dbmod.db().query.affiliateReferrals.findFirst({ where: eq(dbmod.schema.affiliateReferrals.orderId, orderId) });
//
//   it("joins once with a code from the handle", async () => {
//     await expect(aff.joinAffiliate("ref", { payoutEmail: "pp@x.test", acceptTerms: false as true })).rejects.toThrow();
//     const a = await aff.joinAffiliate("ref", { payoutEmail: "pp@x.test", acceptTerms: true });
//     expect(a.code).toBe("referer");
//     expect((await aff.joinAffiliate("ref", { payoutEmail: "other@x.test", acceptTerms: true })).id).toBe(a.id);
//   });
//
//   it("records 30% once per paid order, skips self-referrals and unknown codes", async () => {
//     const a = await aff.joinAffiliate("ref", { payoutEmail: "pp@x.test", acceptTerms: true });
//     const o = await buy("buyer@x.test", a.code);
//     const r = await referralFor(o.id);
//     expect(r).toMatchObject({ affiliateId: a.id, status: "pending", commissionCents: Math.floor(o.amountCents * 0.3) });
//
//     // Confirming again (webhook retry) doesn't add a second commission.
//     await payments.confirmPayment("paystack", `ref-${o.id}`);
//     expect(await dbmod.db().select().from(dbmod.schema.affiliateReferrals)).toHaveLength(1);
//
//     const self = await buy("REF@x.test", a.code);
//     expect(await referralFor(self.id)).toBeUndefined();
//     const unknown = await buy("buyer2@x.test", "nobody");
//     expect(await referralFor(unknown.id)).toBeUndefined();
//
//     await aff.setAffiliateStatus(a.id, "suspended");
//     const suspended = await buy("buyer3@x.test", a.code);
//     expect(await referralFor(suspended.id)).toBeUndefined();
//   });
//
//   it("shrinks on a partial refund and voids on a full one", async () => {
//     const a = await aff.joinAffiliate("ref", { payoutEmail: "pp@x.test", acceptTerms: true });
//     const o = await buy("buyer@x.test", a.code);
//     await payments.refundOrder(o.id, "partial", 1000);
//     expect((await referralFor(o.id))?.commissionCents).toBe(Math.floor((o.amountCents - 1000) * 0.3));
//     await payments.refundOrder(o.id, "rest");
//     expect((await referralFor(o.id))?.status).toBe("void");
//     expect((await aff.referralsFor(a.id)).stats).toMatchObject({ referrals: 0, pendingCents: 0 });
//   });
//
//   it("approves after 30 days and staff mark it paid", async () => {
//     const a = await aff.joinAffiliate("ref", { payoutEmail: "pp@x.test", acceptTerms: true });
//     const o = await buy("buyer@x.test", a.code);
//     const cents = (await referralFor(o.id))!.commissionCents;
//
//     expect(await aff.approveReferrals(new Date(Date.now() + 29 * DAY))).toEqual({ approved: 0 });
//     expect(await aff.approveReferrals(new Date(Date.now() + 31 * DAY))).toEqual({ approved: 1 });
//     const [row] = await aff.listAffiliates();
//     expect(row).toMatchObject({ owedCents: cents, pendingCents: 0, paidCents: 0 });
//
//     expect(await aff.markAffiliatePaid(a.id)).toEqual({ count: 1, cents });
//     expect(await aff.markAffiliatePaid(a.id)).toEqual({ count: 0, cents: 0 });
//     expect((await aff.referralsFor(a.id)).stats).toMatchObject({ paidCents: cents, approvedCents: 0 });
//
//     // Paid-out commissions aren't clawed back by a later refund.
//     await payments.refundOrder(o.id, "late");
//     expect((await referralFor(o.id))?.status).toBe("paid");
//   });
// });

import { it } from "vitest";

it.skip("affiliates are paused", () => {});
