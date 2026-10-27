/**
 * Digest open/click tracking against a real Postgres: signed Resend webhooks,
 * redelivery and unique counts per issue. Runs when TEST_DATABASE_URL is set.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { signSvix } from "@/lib/newsletter/webhook-rules";
import { resetDatabase } from "./helpers/db";

const TEST_DB = process.env.TEST_DATABASE_URL;
const SECRET = `whsec_${Buffer.from("resend-webhook-test-secret").toString("base64")}`;

describe.skipIf(!TEST_DB)("newsletter tracking (Postgres)", () => {
  let dbmod: typeof import("@/db");
  let route: typeof import("@/app/api/webhooks/resend/route");
  let service: typeof import("@/lib/newsletter/service");

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB;
    process.env.RESEND_WEBHOOK_SECRET = SECRET;
    (await import("@/env")).resetEnvForTests();
    await resetDatabase(TEST_DB!);
    dbmod = await import("@/db");
    route = await import("@/app/api/webhooks/resend/route");
    service = await import("@/lib/newsletter/service");
    await dbmod
      .db()
      .insert(dbmod.schema.newsletterIssues)
      .values({ weekKey: "2026-W43", subject: "This week", recipients: 4, sentAt: new Date() });
  });

  afterAll(async () => {
    delete process.env.RESEND_WEBHOOK_SECRET;
    await (dbmod?.db() as unknown as { $client: { end(): Promise<void> } } | undefined)?.$client.end();
  });

  const post = (id: string, payload: unknown, sign = true) => {
    const body = JSON.stringify(payload);
    const ts = String(Math.floor(Date.now() / 1000));
    return route.POST(
      new Request("https://debutyard.test/api/webhooks/resend", {
        method: "POST",
        headers: {
          "svix-id": id,
          "svix-timestamp": ts,
          "svix-signature": sign ? signSvix(id, ts, body, SECRET) : "v1,bad",
        },
        body,
      }),
    );
  };
  const event = (type: string, to: string, extra = {}) => ({
    type,
    created_at: new Date().toISOString(),
    data: { to: [to], tags: { issue: "2026-W43" }, ...extra },
  });

  it("counts unique opens and clicks, ignoring redeliveries and forgeries", async () => {
    expect((await post("m0", event("email.opened", "a@x.test"), false)).status).toBe(401);
    await post("m1", event("email.opened", "a@x.test"));
    await post("m1", event("email.opened", "a@x.test")); // redelivered
    await post("m2", event("email.opened", "a@x.test")); // opened again
    await post("m3", event("email.opened", "b@x.test"));
    await post("m4", event("email.clicked", "b@x.test", { click: { link: "https://debutyard.test/p/acme" } }));
    expect(await (await post("m5", event("email.delivered", "c@x.test"))).json()).toEqual({ stored: false });
    await post("m6", { ...event("email.opened", "c@x.test"), data: { to: ["c@x.test"], tags: { issue: "1999-W01" } } });

    expect((await service.engagementByIssue(["2026-W43"])).get("2026-W43")).toEqual({ opens: 2, clicks: 1 });
    const rows = await dbmod.db().select().from(dbmod.schema.newsletterEvents);
    expect(rows).toHaveLength(4);
  });
});
