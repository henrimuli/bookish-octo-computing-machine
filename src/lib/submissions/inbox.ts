import "server-only";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { env } from "@/env";
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

export const inboundMessage = z.object({
  to: z.union([z.string(), z.array(z.string())]).transform((v) => (Array.isArray(v) ? v : [v])),
  from: z.string().max(500),
  subject: z.string().max(1000).default(""),
  text: z.string().max(500_000).default(""),
  html: z.string().max(1_000_000).nullish(),
});

/** Stores a message sent to one of our order inboxes. Returns null when no order matches. */
export async function receiveInbound(raw: unknown, now = new Date()) {
  const msg = inboundMessage.parse(raw);
  const domain = env().INBOUND_EMAIL_DOMAIN;
  if (!domain) return null;
  for (const to of msg.to) {
    const key = inboxKeyFrom(to, domain);
    if (!key) continue;
    const order = await db().query.submissionOrders.findFirst({ where: eq(orders.inboxKey, key) });
    if (!order) continue;
    const [row] = await db()
      .insert(messages)
      .values({
        submissionOrderId: order.id,
        toAddress: to.slice(0, 500),
        fromAddress: msg.from,
        subject: msg.subject,
        text: msg.text,
        html: msg.html ?? null,
        receivedAt: now,
      })
      .returning({ id: messages.id });
    return { orderId: order.id, messageId: row.id };
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
