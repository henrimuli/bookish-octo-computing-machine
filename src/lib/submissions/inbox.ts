import "server-only";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { env } from "@/env";
import { resendClient } from "@/lib/email";
import { inboxKeyFrom, newInboxKey } from "./inbox-rules";

const { submissionOrders: orders, submissionMessages: messages } = schema;
type Order = typeof orders.$inferSelect;

/** The order's submission inbox, e.g. k3yabc@submit.debutyard.com. Null until INBOUND_EMAIL_DOMAIN is set. */
export async function inboxAddress(order: Pick<Order, "id" | "inboxKey">): Promise<string | null> {
  const domain = env().INBOUND_EMAIL_DOMAIN;
  if (!domain) return null;
  let key = order.inboxKey;
  if (!key) {
    const [row] = await db()
      .update(orders)
      .set({ inboxKey: newInboxKey() })
      .where(eq(orders.id, order.id))
      .returning({ key: orders.inboxKey });
    key = row?.key ?? null;
  }
  return key ? `${key}@${domain}` : null;
}

export type ReceivedEmail = { from: string; subject: string; text: string | null; html: string | null };
/** Loads a received email's content from Resend; tests swap it out. */
export type EmailFetcher = (emailId: string) => Promise<ReceivedEmail | null>;

const resendFetcher: EmailFetcher = async (emailId) => {
  const r = resendClient();
  if (!r) return null;
  // `cid` keeps inline images as references instead of inlining them as base64.
  const { data, error } = await r.emails.receiving.get(emailId, { html_format: "cid" });
  if (error) throw new Error(`Couldn't load received email ${emailId}: ${error.message}`);
  return data;
};

let fetcher: EmailFetcher = resendFetcher;
export function setEmailFetcherForTests(fn: EmailFetcher | undefined) {
  fetcher = fn ?? resendFetcher;
}

/**
 * Stores a Resend `email.received` message sent to one of our order inboxes.
 * Only fetches the body when a recipient matches an order, and Resend's email
 * id keeps redelivered webhooks from storing it twice. Null when nothing matched.
 */
export async function receiveInbound(emailId: string, recipients: string[], now = new Date()) {
  const domain = env().INBOUND_EMAIL_DOMAIN;
  if (!domain) return null;
  for (const to of recipients) {
    const key = inboxKeyFrom(to, domain);
    if (!key) continue;
    const order = await db().query.submissionOrders.findFirst({ where: eq(orders.inboxKey, key) });
    if (!order) continue;
    const seen = await db().query.submissionMessages.findFirst({ where: eq(messages.resendEmailId, emailId) });
    if (seen) return null;
    const email = await fetcher(emailId);
    if (!email) return null;
    const [row] = await db()
      .insert(messages)
      .values({
        submissionOrderId: order.id,
        toAddress: to.slice(0, 500),
        fromAddress: email.from.slice(0, 500),
        subject: email.subject.slice(0, 1000),
        text: (email.text ?? "").slice(0, 500_000),
        html: email.html?.slice(0, 1_000_000) ?? null,
        resendEmailId: emailId,
        receivedAt: now,
      })
      .onConflictDoNothing()
      .returning({ id: messages.id });
    return row ? { orderId: order.id, messageId: row.id } : null;
  }
  return null;
}

export async function messagesFor(orderId: string, limit = 100) {
  return db()
    .select()
    .from(messages)
    .where(eq(messages.submissionOrderId, orderId))
    .orderBy(desc(messages.receivedAt))
    .limit(limit);
}
