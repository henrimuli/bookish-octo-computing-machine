/**
 * DR snapshots against a real Postgres with a fake DR provider: the intake
 * baseline, weekly snapshots, drop alerts, the checker's cache and the
 * directory backfill. Runs when TEST_DATABASE_URL is set; the database is wiped.
 */
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { DrProvider } from "@/lib/metrics/providers";
import type { PaymentProvider, VerifiedPayment, WebhookEvent } from "@/lib/payments/types";
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

class FakePayments implements PaymentProvider {
  readonly id = "paystack" as const;
  verifyResult: VerifiedPayment | null = null;
  async createCheckout(req: { orderId: string }) {
    return { url: `https://pay.test/${req.orderId}`, providerRef: `ref-${req.orderId}` };
  }
  async verifyPayment(ref: string): Promise<VerifiedPayment> {
    return this.verifyResult ?? { status: "pending", providerRef: ref };
  }
  async refund() {
    return { providerRef: "rf" };
  }
  async createPlan() {
    return { planId: "PLN" };
  }
  async createSubscription() {
    return { url: "https://pay.test/sub" };
  }
  async cancelSubscription() {}
  async getSubscription() {
    return { status: "active" as const };
  }
  async parseWebhook(): Promise<WebhookEvent> {
    throw new Error("unused");
  }
}

const dr = new Map<string, number>();
const calls: string[] = [];
const bulkCalls: string[][] = [];
const fakeDr: DrProvider = {
  id: "openpagerank",
  async fetchDr(domain) {
    calls.push(domain);
    return { dr: dr.get(domain) ?? 10, referringDomains: null };
  },
};
const fakeBulkDr: DrProvider = {
  ...fakeDr,
  id: "dataforseo",
  async fetchBulk(domains) {
    bulkCalls.push(domains);
    return new Map(domains.map((d) => [d, { dr: dr.get(d) ?? 20, referringDomains: null }]));
  },
};

describe.skipIf(!TEST_DB)("DR snapshots (Postgres)", () => {
  const pay = new FakePayments();
  let dbmod: typeof import("@/db");
  let metrics: typeof import("@/lib/metrics/service");
  let subs: typeof import("@/lib/submissions/service");
  let payments: typeof import("@/lib/payments/service");
  let products: typeof import("@/lib/products/service");

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB;
    process.env.NEXT_PUBLIC_SITE_URL = "https://debutyard.test";
    process.env.ADMIN_EMAIL = "ops@debutyard.test";
    await resetDatabase(TEST_DB!);
    (await import("@/lib/payments")).setProviderForTests("paystack", pay);
    dbmod = await import("@/db");
    metrics = await import("@/lib/metrics/service");
    subs = await import("@/lib/submissions/service");
    payments = await import("@/lib/payments/service");
    products = await import("@/lib/products/service");
  });

  afterAll(async () => {
    metrics?.setDrProviderForTests(undefined);
    await (dbmod?.db() as unknown as { $client: { end(): Promise<void> } } | undefined)?.$client.end();
  });

  beforeEach(async () => {
    sent.length = 0;
    calls.length = 0;
    bulkCalls.length = 0;
    dr.clear();
    metrics.setDrProviderForTests(fakeDr);
    await dbmod
      .db()
      .execute(
        sql`truncate products, orders, payment_events, submission_orders, submissions, subscriptions, domain_metrics, "user" cascade`,
      );
  });

  async function orderWithIntake(websiteUrl: string) {
    const { orderId } = await payments.startCheckout({
      skuId: "submission_starter",
      provider: "paystack",
      email: "buyer@x.test",
    });
    const o = await dbmod.db().query.orders.findFirst({ where: eq(dbmod.schema.orders.id, orderId) });
    pay.verifyResult = {
      status: "paid",
      providerRef: `ref-${orderId}`,
      orderId,
      amountCents: o!.amountCents,
      currency: "USD",
    };
    await payments.confirmPayment("paystack", `ref-${orderId}`);
    const order = (await dbmod
      .db()
      .query.submissionOrders.findFirst({ where: eq(dbmod.schema.submissionOrders.orderId, orderId) }))!;
    await subs.submitIntake(order.intakeToken, {
      productName: "Acme",
      websiteUrl,
      tagline: "Invoices that chase themselves",
      shortDescription: "Acme sends polite reminders so clients pay on time, every time, without awkward emails.",
      longDescription: "Acme connects to your invoicing tool and follows up on late invoices for you. ".repeat(3),
      categories: ["ai"],
      logoUrl: "",
      founderName: "Ada",
      contactEmail: "ada@acme.io",
      clientNotes: "",
      badgePreference: "none",
      allowAccounts: true,
    });
    return order;
  }

  it("takes a baseline at intake and tracks orders and Maker Pro domains weekly, alerting on drops", async () => {
    dr.set("acme.io", 7);
    const order = await orderWithIntake("https://www.acme.io/");
    expect((await metrics.drHistory("acme.io")).map((p) => p.dr)).toEqual([7]);

    await dbmod.db().insert(dbmod.schema.user).values({ id: "pro", name: "Pro", email: "pro@x.test" });
    await products.saveProduct("pro", {
      websiteUrl: "https://pro.io/",
      name: "pro.io",
      tagline: "pro.io does useful things",
      description: "A".repeat(60),
      categories: ["ai"],
      pricingModel: "freemium",
    });
    await dbmod
      .db()
      .insert(dbmod.schema.subscriptions)
      .values({
        userId: "pro",
        sku: "sub_maker_pro_yearly",
        provider: "paystack",
        providerPlanId: "PLN",
        status: "active",
        currentPeriodEnd: new Date(Date.now() + 365 * DAY),
      });
    dr.set("pro.io", 40);

    // acme.io was measured at intake, so only pro.io is due today.
    const first = await metrics.snapshotDomains(new Date());
    expect(first).toMatchObject({ measured: 1, alerts: 0 });
    calls.length = 0;

    // A week later: acme.io grows, pro.io drops 6 points.
    dr.set("acme.io", 19);
    dr.set("pro.io", 34);
    const week = new Date(Date.now() + 7 * DAY);
    sent.length = 0;
    expect(await metrics.snapshotDomains(week)).toMatchObject({ measured: 2, alerts: 1 });
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: "pro@x.test", subject: "Authority Score alert: pro.io dropped 6 points" });
    expect((await metrics.drHistory("acme.io")).map((p) => p.dr)).toEqual([7, 19]);

    // A 4-point drop is not news.
    dr.set("acme.io", 15);
    sent.length = 0;
    await metrics.snapshotDomains(new Date(Date.now() + 14 * DAY));
    expect(sent.filter((e) => e.subject.includes("acme.io"))).toHaveLength(0);
    dr.set("acme.io", 9);
    await metrics.snapshotDomains(new Date(Date.now() + 21 * DAY));
    expect(sent.find((e) => e.subject.includes("acme.io"))).toMatchObject({ to: "ada@acme.io" });
    expect(sent.find((e) => e.subject.includes("acme.io"))?.text).toContain(`/orders/${order.intakeToken}`);
  });

  it("caches the checker for 7 days with single lookups", async () => {
    metrics.setDrProviderForTests(fakeBulkDr);
    dr.set("foo.io", 33);
    expect((await metrics.drFor("foo.io"))?.dr).toBe(33);
    expect((await metrics.drFor("foo.io"))?.dr).toBe(33);
    expect(calls).toEqual(["foo.io"]);
    expect((await metrics.drFor("foo.io", new Date(Date.now() + 8 * DAY)))?.dr).toBe(33);
    expect(calls).toHaveLength(2);
    expect(bulkCalls).toHaveLength(0);
  });

  it("scores all directories in one bulk request, then again only after a month", async () => {
    metrics.setDrProviderForTests(fakeBulkDr);
    const active = await dbmod
      .db()
      .select()
      .from(dbmod.schema.directories)
      .where(eq(dbmod.schema.directories.isActive, true));
    expect(active.length).toBeGreaterThan(10);
    const [first] = active;
    dr.set(new URL(first.url).hostname.replace(/^www\./, ""), 61);

    const now = new Date();
    expect(await metrics.refreshDirectoryScores(now)).toBe(active.length);
    expect(bulkCalls).toHaveLength(1);
    expect(bulkCalls[0]).toHaveLength(new Set(active.map((d) => new URL(d.url).hostname.replace(/^www\./, ""))).size);
    expect(calls).toHaveLength(0);
    expect(
      (await dbmod.db().query.directories.findFirst({ where: eq(dbmod.schema.directories.id, first.id) }))?.dr,
    ).toBe(61);

    // Nothing is due for the rest of the month, so the daily job makes no request.
    expect(await metrics.refreshDirectoryScores(new Date(now.getTime() + 29 * DAY))).toBe(0);
    expect(bulkCalls).toHaveLength(1);

    // A new directory is scored the next day, on its own small bulk request.
    await dbmod
      .db()
      .update(dbmod.schema.directories)
      .set({ dr: null })
      .where(eq(dbmod.schema.directories.id, first.id));
    expect(await metrics.refreshDirectoryScores(new Date(now.getTime() + DAY))).toBe(1);
    expect(bulkCalls[1]).toHaveLength(1);

    // After 30 days, the whole list is re-measured in one request again.
    dr.set(new URL(first.url).hostname.replace(/^www\./, ""), 64);
    expect(await metrics.refreshDirectoryScores(new Date(now.getTime() + 31 * DAY))).toBe(active.length);
    expect(bulkCalls).toHaveLength(3);
    expect(
      (await dbmod.db().query.directories.findFirst({ where: eq(dbmod.schema.directories.id, first.id) }))?.dr,
    ).toBe(64);
  });

  it("hides itself without a provider", async () => {
    metrics.setDrProviderForTests(null);
    expect(metrics.drEnabled()).toBe(false);
    expect(await metrics.snapshotDomains()).toEqual({ skipped: "no DR provider configured" });
    await orderWithIntake("https://acme.io");
    expect(await metrics.drHistory("acme.io")).toEqual([]);
  });
});
