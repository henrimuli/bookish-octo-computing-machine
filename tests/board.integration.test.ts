/**
 * Launch board flows against a real Postgres: listings, scheduling, paid tiers,
 * moderation refunds, voting, ranking and the weekly rollover.
 * Runs when TEST_DATABASE_URL is set; the database is wiped.
 */
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { PaymentProvider, VerifiedPayment, WebhookEvent } from "@/lib/payments/types";
import { addWeeks, weekBounds, weekKeyFor } from "@/lib/weeks";
import { resetDatabase } from "./helpers/db";

const TEST_DB = process.env.TEST_DATABASE_URL;

const sent: Array<{ to: string; subject: string }> = [];
vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(async (email: { to: string; subject: string }) => {
    sent.push({ to: email.to, subject: email.subject });
  }),
}));

class FakeProvider implements PaymentProvider {
  readonly id = "paystack" as const;
  verifyResult: VerifiedPayment | null = null;
  refunds: number[] = [];
  async createCheckout(req: { orderId: string }) {
    return { url: `https://pay.test/${req.orderId}`, providerRef: `ref-${req.orderId}` };
  }
  async verifyPayment(ref: string): Promise<VerifiedPayment> {
    return this.verifyResult ?? { status: "pending", providerRef: ref };
  }
  async refund(args: { amountCents: number }) {
    this.refunds.push(args.amountCents);
    return { providerRef: `rf-${this.refunds.length}` };
  }
  async createPlan() {
    return { planId: "PLN" };
  }
  async createSubscription() {
    return { url: "https://pay.test/sub" };
  }
  async cancelSubscription() {}
  async parseWebhook(): Promise<WebhookEvent> {
    throw new Error("unused");
  }
}

describe.skipIf(!TEST_DB)("launch board (Postgres)", () => {
  const fake = new FakeProvider();
  let dbmod: typeof import("@/db");
  let products: typeof import("@/lib/products/service");
  let moderation: typeof import("@/lib/products/moderation");
  let payments: typeof import("@/lib/payments/service");
  let engagement: typeof import("@/lib/board/engagement");
  let queries: typeof import("@/lib/board/queries");
  let rollover: typeof import("@/lib/board/rollover");
  let dashboard: typeof import("@/lib/products/dashboard");

  const now = new Date();
  const thisWeek = weekKeyFor(now);
  const nextWeek = addWeeks(thisWeek, 1);

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB;
    process.env.NEXT_PUBLIC_SITE_URL = "https://debutyard.test";
    process.env.ADMIN_EMAIL = "ops@debutyard.test";
    await resetDatabase(TEST_DB!);
    (await import("@/lib/payments")).setProviderForTests("paystack", fake);
    dbmod = await import("@/db");
    products = await import("@/lib/products/service");
    moderation = await import("@/lib/products/moderation");
    payments = await import("@/lib/payments/service");
    engagement = await import("@/lib/board/engagement");
    queries = await import("@/lib/board/queries");
    rollover = await import("@/lib/board/rollover");
    dashboard = await import("@/lib/products/dashboard");
  });

  afterAll(async () => {
    await (dbmod?.db() as unknown as { $client: { end(): Promise<void> } } | undefined)?.$client.end();
  });

  beforeEach(async () => {
    sent.length = 0;
    fake.verifyResult = null;
    fake.refunds = [];
    await dbmod
      .db()
      .execute(
        sql`truncate products, launch_weeks, votes, comments, awards, orders, payment_events, refunds, "user" cascade`,
      );
  });

  let userSeq = 0;
  async function makeUser(ageHours = 1000) {
    const id = `u${++userSeq}`;
    await dbmod
      .db()
      .insert(dbmod.schema.user)
      .values({ id, name: `User ${id}`, email: `${id}@x.test`, createdAt: new Date(Date.now() - ageHours * 3600_000) });
    return id;
  }

  const input = (domain: string, name = domain) => ({
    websiteUrl: `https://${domain}/`,
    name,
    tagline: `${name} does useful things`,
    description: "A".repeat(60),
    categories: ["productivity"],
    pricingModel: "freemium" as const,
  });

  /** Creates an approved listing in a given week, bypassing review. */
  async function liveProduct(userId: string, domain: string, week = thisWeek) {
    const p = await products.saveProduct(userId, input(domain));
    await products.ensureWeek(week);
    await dbmod
      .db()
      .update(dbmod.schema.products)
      .set({ status: "approved", launchWeekKey: week, approvedAt: new Date() })
      .where(eq(dbmod.schema.products.id, p.id));
    return p;
  }

  it("creates listings with categories and a badge token, and blocks duplicate domains", async () => {
    const u = await makeUser();
    const p = await products.saveProduct(u, input("acme.app", "Acme"));
    expect(p).toMatchObject({ slug: "acme", status: "draft", tier: "free", domain: "acme.app" });
    const badge = await dbmod.db().query.badgeVerifications.findFirst({
      where: eq(dbmod.schema.badgeVerifications.productId, p.id),
    });
    expect(badge?.dnsToken).toMatch(/^[0-9a-f]{24}$/);

    await products.submitForReview(p.id, u);
    const other = await makeUser();
    await expect(products.saveProduct(other, input("www.acme.app", "Acme 2"))).rejects.toThrow(/already listed/);
  });

  it("limits makers to two waiting free debuts", async () => {
    const u = await makeUser();
    for (const d of ["a.io", "b.io"]) {
      const p = await products.saveProduct(u, input(d));
      await products.submitForReview(p.id, u);
    }
    const third = await products.saveProduct(u, input("c.io"));
    await expect(products.submitForReview(third.id, u)).rejects.toThrow(/2 free debuts/);
  });

  it("schedules free approvals into the next week with room", async () => {
    const u = await makeUser();
    await products.ensureWeek(nextWeek);
    await dbmod
      .db()
      .update(dbmod.schema.launchWeeks)
      .set({ freeCapacity: 1 })
      .where(eq(dbmod.schema.launchWeeks.key, nextWeek));

    const first = await products.saveProduct(u, input("one.io"));
    await products.submitForReview(first.id, u);
    expect((await moderation.approve(first.id)).launchWeekKey).toBe(nextWeek);

    const u2 = await makeUser();
    const second = await products.saveProduct(u2, input("two.io"));
    await products.submitForReview(second.id, u2);
    expect((await moderation.approve(second.id)).launchWeekKey).toBe(addWeeks(nextWeek, 1));
    expect(sent.some((e) => e.subject.includes("is approved"))).toBe(true);
  });

  it("applies a paid tier after payment and books the requested week", async () => {
    const u = await makeUser();
    const p = await products.saveProduct(u, input("paid.io"));
    const wanted = addWeeks(thisWeek, 3);

    const { orderId } = await payments.startCheckout({
      skuId: "launch_pro",
      provider: "paystack",
      email: `${u}@x.test`,
      userId: u,
      metadata: { productId: p.id, weekKey: wanted },
    });
    await dbmod.db().insert(dbmod.schema.productOrders).values({ orderId, productId: p.id });
    fake.verifyResult = { status: "paid", providerRef: `ref-${orderId}`, orderId, amountCents: 3900, currency: "USD" };
    const order = await payments.confirmPayment("paystack", `ref-${orderId}`);
    expect(order?.fulfilledAt).toBeInstanceOf(Date);

    const after = await dbmod.db().query.products.findFirst({ where: eq(dbmod.schema.products.id, p.id) });
    expect(after).toMatchObject({ tier: "pro", status: "pending", requestedWeekKey: wanted });
    expect((await moderation.approve(p.id)).launchWeekKey).toBe(wanted);
  });

  it("refunds paid listings when they're rejected (money-back guarantee)", async () => {
    const u = await makeUser();
    const p = await products.saveProduct(u, input("refund.io"));
    const { orderId } = await payments.startCheckout({
      skuId: "launch_fast_track",
      provider: "paystack",
      email: `${u}@x.test`,
      userId: u,
      metadata: { productId: p.id, weekKey: null },
    });
    await dbmod.db().insert(dbmod.schema.productOrders).values({ orderId, productId: p.id });
    fake.verifyResult = { status: "paid", providerRef: `ref-${orderId}`, orderId, amountCents: 1500, currency: "USD" };
    await payments.confirmPayment("paystack", `ref-${orderId}`);

    const rejected = await moderation.reject(p.id, "Website doesn't load");
    expect(rejected.status).toBe("rejected");
    expect(fake.refunds).toEqual([1500]);
    const after = await dbmod.db().query.products.findFirst({ where: eq(dbmod.schema.products.id, p.id) });
    expect(after?.tier).toBe("free");
    expect(sent.some((e) => e.subject.startsWith("About your DebutYard submission"))).toBe(true);
  });

  it("only allows votes on live products, weights new accounts, and toggles", async () => {
    const maker = await makeUser();
    const upcoming = await liveProduct(maker, "soon.io", nextWeek);
    const voter = await makeUser(1); // brand-new account
    await expect(
      engagement.toggleVote({ userId: voter, productId: upcoming.id, ip: "1.2.3.4", userAgent: "x" }),
    ).rejects.toThrow(/isn't live/);

    const live = await liveProduct(maker, "live.io");
    expect(await engagement.toggleVote({ userId: voter, productId: live.id, ip: "1.2.3.4", userAgent: "x" })).toEqual({
      voted: true,
      votes: 1,
    });
    const [vote] = await dbmod.db().select().from(dbmod.schema.votes);
    expect(vote).toMatchObject({ weight: 0.25, flagReason: "new account" });
    expect(vote.ipHash).not.toContain("1.2.3.4");

    expect(await engagement.toggleVote({ userId: voter, productId: live.id, ip: null, userAgent: null })).toEqual({
      voted: false,
      votes: 0,
    });
  });

  it("ranks the week by weighted votes plus substantive comments", async () => {
    const maker = await makeUser();
    const a = await liveProduct(maker, "alpha.io");
    const maker2 = await makeUser();
    const b = await liveProduct(maker2, "beta.io");

    const veteran = await makeUser();
    const newbie1 = await makeUser(1);
    const newbie2 = await makeUser(1);
    await engagement.toggleVote({ userId: veteran, productId: a.id, ip: "9.9.9.1", userAgent: null });
    await engagement.toggleVote({ userId: newbie1, productId: b.id, ip: "9.9.9.2", userAgent: null });
    await engagement.toggleVote({ userId: newbie2, productId: b.id, ip: "9.9.9.3", userAgent: null });
    // b has more raw votes (2 vs 1) but new accounts weigh 0.25 each → 0.5 < 1.
    let board = await queries.weekBoard(thisWeek, veteran);
    expect(board.map((x) => [x.slug, x.votes, x.score])).toEqual([
      ["alpha-io", 1, 1],
      ["beta-io", 2, 0.5],
    ]);
    expect(board[0].votedByMe).toBe(true);

    // Two substantive comments (+0.5 each) put b ahead; the maker's own comment doesn't count.
    await engagement.addComment({
      userId: veteran,
      productId: b.id,
      body: "Really like the onboarding, how do you handle exports?",
    });
    await engagement.addComment({
      userId: newbie1,
      productId: b.id,
      body: "Tried it today, the sync is genuinely fast. Nice work!",
    });
    await engagement.addComment({
      userId: maker2,
      productId: b.id,
      body: "Thanks all! Exports are coming next month, stay tuned.",
    });
    board = await queries.weekBoard(thisWeek);
    expect(board[0]).toMatchObject({ slug: "beta-io", score: 1.5, comments: 3 });
  });

  it("closes ended weeks once: awards the top 3 with votes and makes them winners", async () => {
    const lastWeek = addWeeks(thisWeek, -1);
    const voters = [await makeUser(), await makeUser(), await makeUser()];
    const ids: string[] = [];
    for (const [i, d] of ["w1.io", "w2.io", "w3.io", "w4.io", "w5.io"].entries()) {
      const m = await makeUser();
      const p = await liveProduct(m, d, lastWeek);
      ids.push(p.id);
      // w1 gets 3 votes, w2 2, w3 1, w4 1, w5 none — cast inside last week.
      const n = [3, 2, 1, 1, 0][i];
      for (let v = 0; v < n; v++) {
        await dbmod
          .db()
          .insert(dbmod.schema.votes)
          .values({ productId: p.id, userId: voters[v], weight: 1, createdAt: weekBounds(lastWeek).startsAt });
      }
    }

    const closed = await rollover.closeEndedWeeks();
    expect(closed).toEqual([{ week: lastWeek, winners: ["w1-io", "w2-io", "w3-io"] }]);
    const awards = await dbmod.db().select().from(dbmod.schema.awards).orderBy(dbmod.schema.awards.place);
    expect(awards.map((a) => [a.place, a.productId])).toEqual([
      [1, ids[0]],
      [2, ids[1]],
      [3, ids[2]],
    ]);
    const winnerEmails = sent.filter((e) => e.subject.includes("Debut of the Week")).length;
    expect(winnerEmails).toBe(3);

    // Idempotent: a second run awards nothing and sends nothing.
    expect(await rollover.closeEndedWeeks()).toEqual([]);
    expect(sent.filter((e) => e.subject.includes("Debut of the Week")).length).toBe(3);
    const w1 = await dbmod.db().query.products.findFirst({ where: eq(dbmod.schema.products.id, ids[0]) });
    expect(w1?.isWinner).toBe(true);
  });

  it("caps Spotlight at three per week and features paid debuts", async () => {
    const week = addWeeks(thisWeek, 2);
    for (const d of ["s1.io", "s2.io", "s3.io"]) {
      const m = await makeUser();
      const p = await products.saveProduct(m, input(d));
      await dbmod
        .db()
        .update(dbmod.schema.products)
        .set({ tier: "spotlight", status: "pending", requestedWeekKey: week })
        .where(eq(dbmod.schema.products.id, p.id));
    }
    expect(await products.spotlightsBooked(week)).toBe(3);
    expect(await products.spotlightsBooked(addWeeks(week, 1))).toBe(0);

    const m = await makeUser();
    const pro = await liveProduct(m, "featured.io");
    await dbmod.db().update(dbmod.schema.products).set({ tier: "pro" }).where(eq(dbmod.schema.products.id, pro.id));
    const { featuredNow } = await import("@/lib/board/featured");
    expect((await featuredNow()).map((f) => f.slug)).toEqual(["featured-io"]);
  });

  it("hides unlaunched products from the public but lets the maker preview", async () => {
    const maker = await makeUser();
    const p = await liveProduct(maker, "later.io", nextWeek);
    expect(await queries.getProductPage(p.slug, null)).toBeNull();
    expect(await queries.getProductPage(p.slug, { id: maker, staff: false })).toMatchObject({ live: false });
    const live = await liveProduct(maker, "now.io");
    expect(await queries.getProductPage(live.slug, null)).toMatchObject({ live: true, weekRank: 1 });
  });

  it("returns dashboard stats for a maker's listings", async () => {
    const maker = await makeUser();
    const p = await liveProduct(maker, "stats.io");
    await dbmod
      .db()
      .insert(dbmod.schema.productEvents)
      .values([
        { productId: p.id, kind: "view" },
        { productId: p.id, kind: "view" },
        { productId: p.id, kind: "outbound_click" },
      ]);
    const [row] = await dashboard.dashboardProducts(maker);
    expect(row.stats).toMatchObject({ views_30d: 2, clicks_30d: 1, votes: 0 });
  });
});
