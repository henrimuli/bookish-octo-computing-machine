/**
 * Subscriptions and entitlements against a real Postgres with a fake
 * provider: purchase → active → perks, dunning, cancellation, sync and
 * Always Featured. Runs when TEST_DATABASE_URL is set; the database is wiped.
 */
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PaymentProvider, SubscriptionState, VerifiedPayment, WebhookEvent } from "@/lib/payments/types";
import { weekKeyFor } from "@/lib/weeks";
import { resetDatabase } from "./helpers/db";

const TEST_DB = process.env.TEST_DATABASE_URL;
const DAY = 86_400_000;

const sent: Array<{ to: string; subject: string; text: string }> = [];
vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(async (e: { to: string; subject: string; text: string }) => {
    sent.push({ to: e.to, subject: e.subject, text: e.text });
  }),
  sendBatch: vi.fn(async (emails: unknown[]) => emails.length),
}));

class FakeProvider implements PaymentProvider {
  readonly id = "paystack" as const;
  nextEvent: WebhookEvent | null = null;
  state: SubscriptionState = { status: "active" };
  cancelled: string[] = [];
  async createCheckout(req: { orderId: string }) {
    return { url: `https://pay.test/${req.orderId}`, providerRef: `ref-${req.orderId}` };
  }
  async verifyPayment(ref: string): Promise<VerifiedPayment> {
    return { status: "pending", providerRef: ref };
  }
  async refund() {
    return { providerRef: "rf" };
  }
  async createPlan() {
    return { planId: "PLN" };
  }
  async createSubscription(req: { subscriptionId: string }) {
    return { url: `https://pay.test/sub/${req.subscriptionId}`, providerSubscriptionId: `SUB-${req.subscriptionId}` };
  }
  async cancelSubscription(args: { providerSubscriptionId: string }) {
    this.cancelled.push(args.providerSubscriptionId);
  }
  async getSubscription() {
    return this.state;
  }
  async parseWebhook(): Promise<WebhookEvent> {
    if (!this.nextEvent) throw new Error("no event queued");
    return this.nextEvent;
  }
}

describe.skipIf(!TEST_DB)("subscriptions and entitlements (Postgres)", () => {
  const fake = new FakeProvider();
  let dbmod: typeof import("@/db");
  let payments: typeof import("@/lib/payments/service");
  let billing: typeof import("@/lib/billing/service");
  let ent: typeof import("@/lib/billing/entitlements");
  let products: typeof import("@/lib/products/service");
  let featured: typeof import("@/lib/board/featured");
  let ads: typeof import("@/lib/ads/service");

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB;
    process.env.NEXT_PUBLIC_SITE_URL = "https://debutyard.test";
    process.env.ADMIN_EMAIL = "ops@debutyard.test";
    await resetDatabase(TEST_DB!);
    (await import("@/lib/payments")).setProviderForTests("paystack", fake);
    dbmod = await import("@/db");
    payments = await import("@/lib/payments/service");
    billing = await import("@/lib/billing/service");
    ent = await import("@/lib/billing/entitlements");
    products = await import("@/lib/products/service");
    featured = await import("@/lib/board/featured");
    ads = await import("@/lib/ads/service");
  });

  afterAll(async () => {
    await (dbmod?.db() as unknown as { $client: { end(): Promise<void> } } | undefined)?.$client.end();
  });

  beforeEach(async () => {
    sent.length = 0;
    fake.state = { status: "active" };
    await dbmod
      .db()
      .execute(
        sql`truncate products, orders, payment_events, subscriptions, provider_plans, plan_credits, "user" cascade`,
      );
    await dbmod
      .db()
      .insert(dbmod.schema.providerPlans)
      .values(
        ["sub_link_monitor_100", "sub_maker_pro_monthly", "sub_always_featured"].map((sku) => ({
          sku,
          provider: "paystack" as const,
          planId: `PLN_${sku}`,
          amountCents: 900,
        })),
      );
  });

  let seq = 0;
  async function makeUser() {
    const id = `b${++seq}`;
    await dbmod
      .db()
      .insert(dbmod.schema.user)
      .values({ id, name: `User ${id}`, email: `${id}@x.test` });
    return id;
  }
  async function approvedProduct(userId: string, domain: string) {
    const p = await products.saveProduct(userId, {
      websiteUrl: `https://${domain}/`,
      name: domain,
      tagline: `${domain} does useful things`,
      description: "A".repeat(60),
      categories: ["ai"],
      pricingModel: "freemium",
    });
    await products.ensureWeek(weekKeyFor(new Date()));
    await dbmod
      .db()
      .update(dbmod.schema.products)
      .set({ status: "approved", launchWeekKey: weekKeyFor(new Date()), approvedAt: new Date() })
      .where(eq(dbmod.schema.products.id, p.id));
    return p;
  }
  /** Checkout, then the provider's "subscription active" webhook. */
  async function subscribe(userId: string, sku: string, periodEnd = new Date(Date.now() + 30 * DAY)) {
    const { subscriptionId, url } = await payments.startSubscription({
      skuId: sku,
      provider: "paystack",
      userId,
      email: `${userId}@x.test`,
    });
    expect(url).toContain(subscriptionId);
    fake.nextEvent = {
      eventId: `subscription.create:${subscriptionId}`,
      type: "subscription.create",
      kind: "subscription_updated",
      providerSubscriptionId: `SUB-${subscriptionId}`,
      status: "active",
      providerToken: "tok",
      currentPeriodEnd: periodEnd,
    };
    await payments.handleWebhook("paystack", "{}", new Headers());
    return (await dbmod.db().query.subscriptions.findFirst({
      where: eq(dbmod.schema.subscriptions.id, subscriptionId),
    }))!;
  }
  async function event(sub: { id: string }, status: "active" | "past_due" | "cancelled" | "non_renewing") {
    fake.nextEvent = {
      eventId: `evt:${sub.id}:${status}:${Math.random()}`,
      type: "test",
      kind: "subscription_updated",
      providerSubscriptionId: `SUB-${sub.id}`,
      status,
    };
    await payments.handleWebhook("paystack", "{}", new Headers());
    return (await dbmod.db().query.subscriptions.findFirst({ where: eq(dbmod.schema.subscriptions.id, sub.id) }))!;
  }

  it("purchase → active → Maker Pro perks", async () => {
    const u = await makeUser();
    expect(await ent.planFor(u)).toBeNull();
    expect(await ent.limit(u, "links")).toBe(10);

    const sub = await subscribe(u, "sub_maker_pro_monthly");
    expect(sub).toMatchObject({ status: "active", providerToken: "tok" });
    expect(sent.find((e) => e.subject === "Welcome to Maker Pro")?.text).toContain("free Fast Track");
    expect((await ent.planFor(u))?.id).toBe("maker_pro");
    expect(await ent.can(u, "dr_tracking")).toBe(true);
    expect(await ent.can(u, "always_featured")).toBe(false);
    expect(await ent.limit(u, "links")).toBe(100);
    expect((await billing.proUserIds([u, "nobody"])).has(u)).toBe(true);
    // Featured slots: 4 more weeks to book.
    expect(await ads.extraWeeksFor(u)).toBe(4);
    expect(ads.bookableWeeks(new Date(), 4)).toHaveLength(ads.bookableWeeks().length + 4);

    // One free Fast Track per quarter, no payment.
    const p = await products.saveProduct(u, {
      websiteUrl: "https://pro.io/",
      name: "pro.io",
      tagline: "pro.io does useful things",
      description: "A".repeat(60),
      categories: ["ai"],
      pricingModel: "freemium",
      screenshots: ["https://pro.io/shot.png"],
    });
    expect(await billing.fastTrackCredit(u)).toEqual({ eligible: true, available: true });
    const upgraded = await billing.redeemFastTrack(u, p.id);
    expect(upgraded).toMatchObject({ tier: "fast_track", status: "pending" });
    expect(await billing.fastTrackCredit(u)).toEqual({ eligible: true, available: false });
    const q = await products.saveProduct(u, {
      websiteUrl: "https://pro2.io/",
      name: "pro2.io",
      tagline: "pro2.io does useful things",
      description: "A".repeat(60),
      categories: ["ai"],
      pricingModel: "freemium",
      screenshots: ["https://pro2.io/shot.png"],
    });
    await expect(billing.redeemFastTrack(u, q.id)).rejects.toThrow("used this quarter");
    // Next quarter it's back.
    const nextQuarter = new Date(Date.now() + 100 * DAY);
    await dbmod
      .db()
      .update(dbmod.schema.subscriptions)
      .set({ currentPeriodEnd: new Date(nextQuarter.getTime() + 30 * DAY) });
    expect(await billing.fastTrackCredit(u, nextQuarter)).toEqual({ eligible: true, available: true });

    // Without Pro there's no credit.
    const free = await makeUser();
    expect(await billing.fastTrackCredit(free)).toEqual({ eligible: false, available: false });
    await expect(billing.redeemFastTrack(free, q.id)).rejects.toThrow();
  });

  it("past_due → dunning on day 0, 3 and 7 → the plan ends, data kept", async () => {
    const u = await makeUser();
    const sub = await subscribe(u, "sub_link_monitor_100");
    await dbmod.db().insert(dbmod.schema.trackedLinks).values({
      ownerUserId: u,
      url: "https://dir.example/p",
      targetDomain: "maker.io",
      source: "manual",
    });
    sent.length = 0;

    // The provider agrees when the daily sync asks.
    fake.state = { status: "past_due" };
    const due = await event(sub, "past_due");
    expect(due).toMatchObject({ status: "past_due", dunningStage: 1 });
    expect(sent.map((e) => e.subject)).toEqual(["Your Link Monitor payment didn't go through"]);
    // Still entitled while dunning runs.
    expect(await ent.limit(u, "links")).toBe(100);

    const t0 = due.pastDueAt!;
    const at = (days: number) => new Date(t0.getTime() + days * DAY + 60_000);
    sent.length = 0;
    expect((await billing.syncSubscriptions(at(1))).dunning).toBe(0);
    expect((await billing.syncSubscriptions(at(3))).dunning).toBe(1);
    expect(sent.map((e) => e.subject)).toEqual(["Reminder: your Link Monitor payment is still failing"]);
    expect((await billing.syncSubscriptions(at(4))).dunning).toBe(0);
    sent.length = 0;
    expect((await billing.syncSubscriptions(at(7))).dunning).toBe(1);
    expect(sent.map((e) => e.subject)).toEqual(["Your Link Monitor plan has ended"]);
    const ended = await dbmod.db().query.subscriptions.findFirst({ where: eq(dbmod.schema.subscriptions.id, sub.id) });
    expect(ended).toMatchObject({ status: "cancelled", dunningStage: 3 });
    expect(await ent.limit(u, "links")).toBe(10);
    expect(await dbmod.db().select().from(dbmod.schema.trackedLinks)).toHaveLength(1);
    expect((await billing.syncSubscriptions(at(8))).dunning).toBe(0);
  });

  it("a payment that recovers during dunning keeps the plan", async () => {
    const u = await makeUser();
    const sub = await subscribe(u, "sub_link_monitor_100");
    await event(sub, "past_due");
    sent.length = 0;
    const back = await event(sub, "active");
    expect(back).toMatchObject({ status: "active", pastDueAt: null, dunningStage: 0 });
    expect(sent.map((e) => e.subject)).toEqual(["Your Link Monitor payment went through"]);
  });

  it("cancel → non_renewing until the period ends, even if the provider says cancelled", async () => {
    const u = await makeUser();
    const periodEnd = new Date(Date.now() + 10 * DAY);
    const sub = await subscribe(u, "sub_maker_pro_monthly", periodEnd);
    sent.length = 0;
    await payments.cancelSubscription(sub.id, u);
    expect(fake.cancelled).toContain(`SUB-${sub.id}`);
    let row = (await dbmod.db().query.subscriptions.findFirst({ where: eq(dbmod.schema.subscriptions.id, sub.id) }))!;
    expect(row.status).toBe("non_renewing");
    expect(sent.map((e) => e.subject)).toEqual(["Your Maker Pro plan won't renew"]);
    expect(await ent.can(u, "pro_badge")).toBe(true);
    // Cancelling twice does nothing.
    await payments.cancelSubscription(sub.id, u);
    expect(sent).toHaveLength(1);

    row = await event(sub, "cancelled");
    expect(row.status).toBe("non_renewing");
    // A stale "active" from the provider doesn't undo the cancellation.
    row = await event(sub, "active");
    expect(row.status).toBe("non_renewing");
    fake.state = { status: "cancelled" };

    const after = new Date(periodEnd.getTime() + 60_000);
    expect(await ent.can(u, "pro_badge", after)).toBe(false);
    await billing.syncSubscriptions(after);
    row = (await dbmod.db().query.subscriptions.findFirst({ where: eq(dbmod.schema.subscriptions.id, sub.id) }))!;
    expect(row.status).toBe("cancelled");
    expect(sent.at(-1)?.subject).toBe("Your Maker Pro plan has ended");
  });

  it("ends non-renewing plans at period end even without hearing from the provider", async () => {
    const u = await makeUser();
    const periodEnd = new Date(Date.now() + 5 * DAY);
    const sub = await subscribe(u, "sub_link_monitor_100", periodEnd);
    await payments.cancelSubscription(sub.id, u);
    // No provider id to re-fetch with, so only the period end applies.
    await dbmod
      .db()
      .update(dbmod.schema.subscriptions)
      .set({ providerSubscriptionId: null })
      .where(eq(dbmod.schema.subscriptions.id, sub.id));
    expect((await billing.syncSubscriptions(new Date(periodEnd.getTime() + 60_000))).ended).toBe(1);
  });

  it("re-fetches subscriptions we haven't heard about in a day", async () => {
    const u = await makeUser();
    const sub = await subscribe(u, "sub_link_monitor_100");
    expect((await billing.syncSubscriptions()).synced).toBe(0);
    fake.state = { status: "past_due" };
    sent.length = 0;
    const res = await billing.syncSubscriptions(new Date(Date.now() + DAY + 60_000));
    expect(res).toMatchObject({ synced: 1 });
    const row = await dbmod.db().query.subscriptions.findFirst({ where: eq(dbmod.schema.subscriptions.id, sub.id) });
    expect(row?.status).toBe("past_due");
    expect(sent[0].subject).toContain("didn't go through");
  });

  it("Always Featured puts the chosen listing in the rail and on its category page", async () => {
    const u = await makeUser();
    const p = await approvedProduct(u, "always.io");
    const sub = await subscribe(u, "sub_always_featured");
    expect(sent.find((e) => e.subject === "Welcome to Always Featured")).toBeDefined();
    expect((await featured.featuredNow()).map((f) => f.slug)).not.toContain(p.slug);

    const other = await makeUser();
    const theirs = await approvedProduct(other, "theirs.io");
    await expect(billing.setFeaturedListing(u, sub.id, theirs.id)).rejects.toThrow("your listings");
    await billing.setFeaturedListing(u, sub.id, p.id);

    const rail = await featured.featuredNow();
    expect(rail[0]).toMatchObject({ slug: p.slug, tier: "always", hero: false });
    expect(await featured.alwaysFeaturedSponsor("ai")).toMatchObject({ slug: p.slug, bookingId: null });
    expect(await featured.alwaysFeaturedSponsor("finance")).toBeNull();

    // Ends with the plan.
    await dbmod
      .db()
      .update(dbmod.schema.subscriptions)
      .set({ status: "cancelled" })
      .where(eq(dbmod.schema.subscriptions.id, sub.id));
    expect((await featured.featuredNow()).map((f) => f.slug)).not.toContain(p.slug);
  });
});
