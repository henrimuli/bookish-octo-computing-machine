/**
 * The support inbox against a real Postgres: mail to support@ arriving through
 * the Resend webhook, threading of replies, and hand-written replies going out
 * through the branded template. Runs when TEST_DATABASE_URL is set; the database is wiped.
 */
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { signSvix } from "@/lib/newsletter/webhook-rules";
import type { InboundEmail } from "@/lib/support/service";
import { resetDatabase } from "./helpers/db";

const TEST_DB = process.env.TEST_DATABASE_URL;
const WEBHOOK_SECRET = `whsec_${Buffer.from("support-webhook-secret").toString("base64")}`;

type Sent = {
  to: string;
  from?: string;
  replyTo?: string;
  subject: string;
  text: string;
  headers?: Record<string, string>;
};
const sent: Sent[] = [];
vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(async (e: Sent) => {
    sent.push(e);
    return `sent_${sent.length}`;
  }),
  sendBatch: vi.fn(async (emails: unknown[]) => emails.length),
  resendClient: () => null,
}));

describe.skipIf(!TEST_DB)("support inbox (Postgres)", () => {
  let dbmod: typeof import("@/db");
  let support: typeof import("@/lib/support/service");
  let route: typeof import("@/app/api/webhooks/resend/route");
  const mail = new Map<string, InboundEmail>();
  let seq = 0;

  const inbound = (over: Partial<InboundEmail>): InboundEmail => ({
    from: "Ada Okafor <ada@maker.test>",
    to: ["support@debutyard.com"],
    cc: null,
    subject: "Billing question",
    text: "Hi, can I move my launch week?",
    html: null,
    headers: null,
    messageId: `<m${++seq}@maker.test>`,
    attachments: [],
    ...over,
  });

  const post = async (emailId: string, recipients: string[]) => {
    const svixId = `s-${emailId}-${++seq}`;
    const body = JSON.stringify({
      type: "email.received",
      created_at: new Date().toISOString(),
      data: { email_id: emailId, to: recipients, received_for: recipients },
    });
    const ts = String(Math.floor(Date.now() / 1000));
    const res = await route.POST(
      new Request("https://debutyard.test/api/webhooks/resend", {
        method: "POST",
        headers: {
          "svix-id": svixId,
          "svix-timestamp": ts,
          "svix-signature": signSvix(svixId, ts, body, WEBHOOK_SECRET),
        },
        body,
      }),
    );
    return (await res.json()) as { stored: boolean };
  };
  const threadOf = async (resendEmailId: string) =>
    (await dbmod
      .db()
      .query.supportMessages.findFirst({ where: eq(dbmod.schema.supportMessages.resendEmailId, resendEmailId) }))!
      .threadId;

  const henry = { id: "staff-henry", name: "Henry Muli" };

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB;
    process.env.NEXT_PUBLIC_SITE_URL = "https://debutyard.test";
    process.env.RESEND_WEBHOOK_SECRET = WEBHOOK_SECRET;
    (await import("@/env")).resetEnvForTests();
    await resetDatabase(TEST_DB!);
    dbmod = await import("@/db");
    support = await import("@/lib/support/service");
    route = await import("@/app/api/webhooks/resend/route");
    support.setSupportFetcherForTests(async (id) => mail.get(id) ?? null);
    const { schema } = dbmod;
    await dbmod
      .db()
      .insert(schema.user)
      .values([
        { id: henry.id, name: henry.name, email: "henry@debutyard.test" },
        { id: "maker-ada", name: "Ada Okafor", email: "Ada@Maker.test" },
      ]);
    await dbmod.db().insert(schema.products).values({
      slug: "formcrate",
      name: "Formcrate",
      tagline: "Forms to Notion",
      websiteUrl: "https://formcrate.test",
      domain: "formcrate.test",
      createdBy: "maker-ada",
    });
  });

  afterAll(() => support?.setSupportFetcherForTests(undefined));

  it("files mail to support@ as a new unread conversation once, tagging makers", async () => {
    mail.set("in_1", inbound({}));
    expect(await post("in_1", ["support@debutyard.com"])).toEqual({ stored: true });
    // Resend redelivers the same email id.
    expect(await post("in_1", ["support@debutyard.com"])).toEqual({ stored: false });

    const { rows } = await support.listThreads({ folder: "inbox", me: henry.id });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      subject: "Billing question",
      contactEmail: "ada@maker.test",
      contactName: "Ada Okafor",
      unread: true,
      maker: true,
      messageCount: 1,
    });
    expect((await support.folderCounts(henry.id)).inbox).toBe(1);
    const detail = await support.getThread(rows[0].id);
    expect(detail?.customer?.products.map((p) => p.name)).toEqual(["Formcrate"]);
  });

  it("replies through the branded template, signed by the staff member, and takes the conversation", async () => {
    const threadId = await threadOf("in_1");
    await support.sendSupportEmail(
      {
        mode: "reply",
        threadId,
        to: ["ada@maker.test"],
        cc: [],
        subject: "Re: Billing question",
        body: "Yes, done.\n\n- Week 45",
      },
      henry,
    );
    const out = sent.at(-1)!;
    expect(out.to).toBe("ada@maker.test");
    expect(out.from).toBe("DebutYard Support <support@debutyard.com>");
    expect(out.replyTo).toMatch(/^support\+[a-z0-9]{12}@debutyard\.com$/);
    expect(out.headers?.["In-Reply-To"]).toBe("<m1@maker.test>");
    expect(out.text).toContain("— Henry, DebutYard");
    expect(out.text).toContain("> Hi, can I move my launch week?");

    const { thread, messages } = (await support.getThread(threadId))!;
    expect(thread).toMatchObject({ assigneeId: henry.id, unread: false, messageCount: 2, status: "open" });
    expect(messages.map((m) => m.direction)).toEqual(["in", "out"]);
    expect(messages[1].resendEmailId).toBe(`sent_${sent.length}`);
    expect((await support.listThreads({ folder: "sent", me: henry.id })).rows).toHaveLength(1);
    expect((await support.listThreads({ folder: "mine", me: henry.id })).rows).toHaveLength(1);
  });

  it("threads replies by reply address, by headers and by subject, and reopens finished ones", async () => {
    const threadId = await threadOf("in_1");
    const replyTo = sent.at(-1)!.replyTo!;
    await support.setStatus([threadId], "done");

    mail.set("in_2", inbound({ subject: "Re: Billing question", text: "Thanks!", to: [replyTo] }));
    expect(await post("in_2", [replyTo])).toEqual({ stored: true });
    expect(await threadOf("in_2")).toBe(threadId);
    expect((await support.getThread(threadId))!.thread).toMatchObject({
      status: "open",
      unread: true,
      messageCount: 3,
    });

    // Sent to the bare address, but answering a message we stored.
    mail.set("in_3", inbound({ subject: "Different words", headers: { "In-Reply-To": "<m1@maker.test>" } }));
    await post("in_3", ["support@debutyard.com"]);
    expect(await threadOf("in_3")).toBe(threadId);

    // No key or headers: a "Re:" of a recent conversation from the same person.
    mail.set("in_4", inbound({ subject: "RE: Billing question" }));
    await post("in_4", ["support@debutyard.com"]);
    expect(await threadOf("in_4")).toBe(threadId);

    // A fresh subject starts a new conversation.
    mail.set("in_5", inbound({ subject: "Logo upload fails" }));
    await post("in_5", ["support@debutyard.com"]);
    expect(await threadOf("in_5")).not.toBe(threadId);
  });

  it("ignores mail from our own address and keeps spam in spam", async () => {
    mail.set("in_6", inbound({ from: "DebutYard Support <support@debutyard.com>" }));
    expect(await post("in_6", ["support@debutyard.com"])).toEqual({ stored: false });

    const spamThread = await threadOf("in_5");
    await support.setStatus([spamThread], "spam");
    mail.set(
      "in_7",
      inbound({ subject: "Re: Logo upload fails", headers: { References: mail.get("in_5")!.messageId! } }),
    );
    await post("in_7", ["support@debutyard.com"]);
    expect((await support.getThread(spamThread))!.thread.status).toBe("spam");
    expect((await support.folderCounts(henry.id)).spam).toBe(1);
  });

  it("starts new conversations from Compose", async () => {
    const { threadId } = await support.sendSupportEmail(
      { mode: "new", to: ["Someone@New.test"], cc: [], subject: "Your launch", body: "Hello!" },
      henry,
    );
    expect(sent.at(-1)!.to).toBe("someone@new.test");
    const { thread } = (await support.getThread(threadId))!;
    expect(thread).toMatchObject({
      contactEmail: "someone@new.test",
      subject: "Your launch",
      assigneeId: henry.id,
      unread: false,
    });
    expect((await support.listThreads({ folder: "inbox", me: henry.id, q: "launch" })).rows.map((r) => r.id)).toContain(
      threadId,
    );
  });
});
