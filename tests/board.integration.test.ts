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

const sent: Array<{ to: string; subject: string; text?: string; headers?: Record<string, string> }> = [];
const batches: string[] = [];
vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(async (email: { to: string; subject: string; text: string }) => {
    sent.push({ to: email.to, subject: email.subject, text: email.text });
  }),
  sendBatch: vi.fn(
    async (emails: Array<{ to: string; subject: string; headers?: Record<string, string> }>, key: string) => {
      batches.push(key);
      for (const e of emails) sent.push({ to: e.to, subject: e.subject, headers: e.headers });
      return emails.length;
    },
  ),
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
  let duels: typeof import("@/lib/board/duels");
  let newsletter: typeof import("@/lib/newsletter/service");
  let blog: typeof import("@/lib/blog/service");

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
    duels = await import("@/lib/board/duels");
    newsletter = await import("@/lib/newsletter/service");
    blog = await import("@/lib/blog/service");
  });

  afterAll(async () => {
    await (dbmod?.db() as unknown as { $client: { end(): Promise<void> } } | undefined)?.$client.end();
  });

  beforeEach(async () => {
    sent.length = 0;
    batches.length = 0;
    fake.verifyResult = null;
    fake.refunds = [];
    await dbmod.db().execute(
      sql`truncate products, launch_weeks, votes, comments, awards, orders, payment_events, refunds, closed_periods,
          newsletter_subscribers, newsletter_issues, posts, "user" cascade`,
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

  async function voteAt(productId: string, userId: string, at: Date) {
    await dbmod.db().insert(dbmod.schema.votes).values({ productId, userId, weight: 1, createdAt: at });
  }

  it("scores each product on its own debut week and awards ended months once", async () => {
    // September 2026 = W37..W40 (weeks whose Monday falls in September).
    const [w37, w38] = ["2026-W37", "2026-W38"];
    const voters = [await makeUser(), await makeUser(), await makeUser()];
    const a = await liveProduct(await makeUser(), "sep-a.io", w37);
    const b = await liveProduct(await makeUser(), "sep-b.io", w38);
    const c = await liveProduct(await makeUser(), "sep-c.io", w38);
    const inWeek = (w: string) => new Date(weekBounds(w).startsAt.getTime() + 3600_000);
    await voteAt(a.id, voters[0], inWeek(w37));
    await voteAt(a.id, voters[1], inWeek(w37));
    for (const v of voters) await voteAt(b.id, v, inWeek(w38));
    // Votes after a product's debut week show on the page but don't score.
    for (const v of voters) await voteAt(c.id, v, inWeek("2026-W39"));

    const board = await queries.boardForWeeks([w37, w38]);
    expect(board.map((p) => [p.slug, p.votes, p.score, p.weekKey])).toEqual([
      ["sep-b-io", 3, 3, w38],
      ["sep-a-io", 2, 2, w37],
      ["sep-c-io", 3, 0, w38],
    ]);

    const now = new Date("2026-10-26T01:00:00Z");
    await rollover.closeEndedPeriods(now);
    const monthAwards = await dbmod.db().query.awards.findMany({
      where: eq(dbmod.schema.awards.scope, "month"),
      orderBy: (aw, { asc }) => asc(aw.place),
    });
    expect(monthAwards.map((aw) => [aw.periodKey, aw.place, aw.productId])).toEqual([
      ["2026-09", 1, b.id],
      ["2026-09", 2, a.id],
    ]);
    expect(sent.filter((e) => e.subject.includes("Debut of the Month")).length).toBe(2);
    // The year isn't over, so no yearly awards yet; a re-run changes nothing.
    await rollover.closeEndedPeriods(now);
    expect(await dbmod.db().select().from(dbmod.schema.awards)).toHaveLength(2);
  });

  it("serves duel pairs the viewer hasn't voted on and runs out cleanly", async () => {
    const viewer = await makeUser();
    const ps = [];
    for (const d of ["d1.io", "d2.io", "d3.io"]) ps.push(await liveProduct(await makeUser(), d));
    await voteAt(ps[0].id, viewer, new Date());

    const pair = await duels.duelPair(viewer);
    expect(pair?.map((p) => p.id).sort()).toEqual([ps[1].id, ps[2].id].sort());
    expect(await duels.duelPair(viewer, [ps[1].id])).toBeNull();
    // Signed-out visitors can see every live product.
    expect(await duels.duelPair(null, [ps[0].id])).not.toBeNull();
  });

  it("runs newsletter double opt-in, sends the digest once per week, and unsubscribes", async () => {
    expect(await newsletter.subscribe(" Reader@X.test ", "footer")).toBe("confirm_sent");
    expect(await newsletter.subscribe("reader@x.test")).toBe("recently_sent");
    const confirm = sent.find((e) => e.to === "reader@x.test");
    const token = confirm?.text?.match(/token=([\w-]+)/)?.[1];
    expect(token).toBeTruthy();
    expect(await newsletter.confirmSubscription("nope")).toBe(false);
    expect(await newsletter.confirmSubscription(token!)).toBe(true);
    expect(await newsletter.subscribe("reader@x.test")).toBe("already_subscribed");
    await newsletter.subscribe("pending@x.test");

    // Nothing to send until last week has closed.
    expect(await newsletter.sendWeeklyDigest(now)).toEqual({ skipped: "week not closed" });

    const lastWeek = addWeeks(thisWeek, -1);
    const voter = await makeUser();
    const w = await liveProduct(await makeUser(), "digest-win.io", lastWeek);
    await voteAt(w.id, voter, weekBounds(lastWeek).startsAt);
    await liveProduct(await makeUser(), "digest-new.io", thisWeek);
    await rollover.closeEndedWeeks();

    sent.length = 0;
    expect(await newsletter.sendWeeklyDigest(now)).toEqual({ week: lastWeek, sent: 1 });
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe("reader@x.test");
    expect(sent[0].subject).toContain("digest-win.io wins");
    expect(sent[0].headers?.["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
    expect(batches).toEqual([`digest-${lastWeek}`]);

    expect(await newsletter.sendWeeklyDigest(now)).toEqual({ skipped: "already sent or in progress" });
    expect(await newsletter.unsubscribe(token!)).toBe(true);
    expect(await newsletter.subscriberCounts()).toEqual({ active: 0, pending: 1, unsubscribed: 1 });
  });

  it("saves, publishes and hides blog posts", async () => {
    const author = await makeUser();
    const a = await blog.savePost(author, { title: "Launch tips", body: "Hello **world**." });
    const b = await blog.savePost(author, { title: "Launch tips", body: "" });
    expect([a.slug, b.slug]).toEqual(["launch-tips", "launch-tips-2"]);
    expect(a.excerpt).toBe("Hello world.");

    expect(await blog.publishedPost("launch-tips")).toBeNull();
    await expect(blog.setPublished(b.id, true)).rejects.toThrow("Write something");
    await blog.setPublished(a.id, true);
    expect((await blog.publishedPost("launch-tips"))?.authorName).toBe(`User ${author}`);
    expect((await blog.publishedPosts()).map((p) => p.slug)).toEqual(["launch-tips"]);

    await blog.setPublished(a.id, false);
    expect(await blog.publishedPosts()).toEqual([]);
  });

  it("drafts one recap per closed week with maker text escaped", async () => {
    const lastWeek = addWeeks(thisWeek, -1);
    expect(await blog.draftWeeklyRecap(now)).toEqual({ skipped: "week not closed" });

    const voter = await makeUser();
    const p = await products.saveProduct(await makeUser(), {
      ...input("recap-a.io", "Evil [x](javascript:alert(1))"),
    });
    await products.ensureWeek(lastWeek);
    await dbmod
      .db()
      .update(dbmod.schema.products)
      .set({ status: "approved", launchWeekKey: lastWeek, approvedAt: new Date() })
      .where(eq(dbmod.schema.products.id, p.id));
    await liveProduct(await makeUser(), "recap-b.io", lastWeek);
    await voteAt(p.id, voter, weekBounds(lastWeek).startsAt);
    await rollover.closeEndedWeeks();

    const res = await blog.draftWeeklyRecap(now);
    expect(res).toHaveProperty("drafted");
    expect(await blog.draftWeeklyRecap(now)).toEqual({ skipped: "already drafted" });

    const [post] = await dbmod.db().select().from(dbmod.schema.posts);
    expect(post).toMatchObject({ kind: "recap", weekKey: lastWeek, status: "draft" });
    expect(post.body).toContain("## Debut of the Week");
    expect(post.body).toContain("## Also debuting");
    const { renderMarkdown } = await import("@/lib/blog/markdown");
    const html = renderMarkdown(post.body);
    expect(html).not.toContain('href="javascript');
    expect(html).toContain("Evil [x](javascript:alert(1))");
    expect(sent.some((e) => e.subject.startsWith("Recap draft ready"))).toBe(true);
  });
});
