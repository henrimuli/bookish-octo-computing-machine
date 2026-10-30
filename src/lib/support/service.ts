import "server-only";
import { and, asc, count, desc, eq, gt, ilike, inArray, isNull, notInArray, or, sql, type SQL } from "drizzle-orm";
import { site } from "@/config/site";
import { db, schema } from "@/db";
import type { SupportAttachment } from "@/db/schema";
import { renderEmail, type RenderedEmail } from "@/lib/email-template";
import { resendClient, sendEmail } from "@/lib/email";
import {
  baseSubject,
  bodyToBlocks,
  header,
  newReplyKey,
  parseAddress,
  quoteCite,
  referencedIds,
  replyAddress,
  snippetFrom,
  supportKeyFrom,
} from "./rules";

const { supportThreads: threads, supportMessages: messages, user, products } = schema;
type Thread = typeof threads.$inferSelect;
type Message = typeof messages.$inferSelect;

/** A received email as the inbox needs it. */
export type InboundEmail = {
  from: string;
  to: string[];
  cc: string[] | null;
  subject: string;
  text: string | null;
  html: string | null;
  headers: Record<string, string> | null;
  messageId: string | null;
  attachments: SupportAttachment[];
};
/** Loads a received email from Resend; tests swap it out. */
export type InboundFetcher = (emailId: string) => Promise<InboundEmail | null>;

const resendFetcher: InboundFetcher = async (emailId) => {
  const r = resendClient();
  if (!r) return null;
  // Default html_format inlines embedded images as data: URIs, which the viewer allows.
  const { data, error } = await r.emails.receiving.get(emailId);
  if (error) throw new Error(`Couldn't load received email ${emailId}: ${error.message}`);
  if (!data) return null;
  return {
    from: data.from,
    to: data.to,
    cc: data.cc,
    subject: data.subject,
    text: data.text,
    html: data.html,
    headers: data.headers,
    messageId: data.message_id || null,
    attachments: data.attachments
      .filter((a) => a.content_disposition !== "inline")
      .map((a) => ({ id: a.id, filename: a.filename, size: a.size, contentType: a.content_type })),
  };
};

let fetcher: InboundFetcher = resendFetcher;
export function setSupportFetcherForTests(fn: InboundFetcher | undefined) {
  fetcher = fn ?? resendFetcher;
}

const isSupportRecipient = (address: string) => supportKeyFrom(address, site.supportEmail) !== null;
export const supportRecipient = (recipients: string[]) => recipients.find(isSupportRecipient) ?? null;

/** The conversation an incoming email belongs to: reply key, then mail headers, then a recent same-subject thread. */
async function findThread(key: string, email: InboundEmail, contact: string, now: Date): Promise<Thread | null> {
  if (key) {
    const byKey = await db().query.supportThreads.findFirst({ where: eq(threads.replyKey, key) });
    if (byKey) return byKey;
  }
  const refs = referencedIds(header(email.headers, "in-reply-to"), header(email.headers, "references"));
  if (refs.length) {
    const [hit] = await db()
      .select({ thread: threads })
      .from(messages)
      .innerJoin(threads, eq(threads.id, messages.threadId))
      .where(inArray(messages.messageId, refs.slice(0, 50)))
      .orderBy(desc(messages.createdAt))
      .limit(1);
    if (hit) return hit.thread;
  }
  const subject = baseSubject(email.subject);
  if (!subject || subject === email.subject.trim()) return null;
  const [recent] = await db()
    .select()
    .from(threads)
    .where(
      and(
        eq(threads.contactEmail, contact),
        sql`lower(${threads.subject}) in (${subject.toLowerCase()}, ${`re: ${subject}`.toLowerCase()})`,
        gt(threads.lastMessageAt, new Date(now.getTime() - 30 * 86_400_000)),
      ),
    )
    .orderBy(desc(threads.lastMessageAt))
    .limit(1);
  return recent ?? null;
}

/**
 * Stores a Resend `email.received` message sent to support@ (or a thread's
 * support+key@ reply address). Null when it isn't for support, was already
 * stored, or came from our own address (no loops).
 */
export async function receiveSupport(emailId: string, recipients: string[], now = new Date()) {
  const to = supportRecipient(recipients);
  if (to === null) return null;
  const seen = await db().query.supportMessages.findFirst({ where: eq(messages.resendEmailId, emailId) });
  if (seen) return null;
  const email = await fetcher(emailId);
  if (!email) return null;
  const from = parseAddress(email.from);
  if (isSupportRecipient(from.email)) return null;

  const key = supportKeyFrom(to, site.supportEmail) ?? "";
  const text = (email.text ?? "").slice(0, 500_000);
  const found = await findThread(key, email, from.email, now);
  return db().transaction(async (tx) => {
    let thread = found;
    if (!thread) {
      [thread] = await tx
        .insert(threads)
        .values({
          replyKey: newReplyKey(),
          subject: email.subject.slice(0, 1000),
          contactEmail: from.email,
          contactName: from.name,
          lastMessageAt: now,
          createdAt: now,
        })
        .returning();
    }
    const [row] = await tx
      .insert(messages)
      .values({
        threadId: thread.id,
        direction: "in",
        fromAddress: from.email.slice(0, 500),
        fromName: from.name?.slice(0, 200) ?? null,
        toAddresses: email.to.slice(0, 50),
        ccAddresses: (email.cc ?? []).slice(0, 50),
        subject: email.subject.slice(0, 1000),
        text,
        html: email.html?.slice(0, 5_000_000) ?? null,
        messageId: email.messageId,
        inReplyTo: header(email.headers, "in-reply-to"),
        references: header(email.headers, "references")?.slice(0, 5000) ?? null,
        attachments: email.attachments,
        resendEmailId: emailId,
        createdAt: now,
      })
      .onConflictDoNothing()
      .returning({ id: messages.id });
    if (!row) return null;
    await tx
      .update(threads)
      .set({
        unread: true,
        // A reply reopens a finished or binned conversation; spam stays spam.
        status: sql`case when ${threads.status} = 'spam' then 'spam'::support_status else 'open'::support_status end`,
        snippet: snippetFrom(text || email.subject),
        messageCount: sql`${threads.messageCount} + 1`,
        lastMessageAt: now,
        contactName: sql`coalesce(${threads.contactName}, ${from.name})`,
      })
      .where(eq(threads.id, thread.id));
    return { threadId: thread.id, messageId: row.id };
  });
}

export const FOLDERS = ["inbox", "starred", "sent", "done", "spam", "trash", "mine", "unassigned"] as const;
export type Folder = (typeof FOLDERS)[number];

function folderWhere(folder: Folder, me: string): SQL | undefined {
  const live = notInArray(threads.status, ["spam", "trash"]);
  switch (folder) {
    case "inbox":
      return eq(threads.status, "open");
    case "starred":
      return and(eq(threads.starred, true), live);
    case "sent":
      return and(
        live,
        sql`exists (select 1 from ${messages} where ${messages.threadId} = ${threads.id} and ${messages.direction} = 'out')`,
      );
    case "done":
      return eq(threads.status, "done");
    case "spam":
      return eq(threads.status, "spam");
    case "trash":
      return eq(threads.status, "trash");
    case "mine":
      return and(eq(threads.status, "open"), eq(threads.assigneeId, me));
    case "unassigned":
      return and(eq(threads.status, "open"), isNull(threads.assigneeId));
  }
}

/** Whether the contact has a DebutYard account with at least one product. */
const isMaker = sql<boolean>`exists (select 1 from ${products} p join ${user} u on u.id = p.created_by where lower(u.email) = ${threads.contactEmail})`;

export const PAGE_SIZE = 50;

export async function listThreads(opts: { folder: Folder; me: string; q?: string; page?: number }) {
  const q = opts.q?.trim();
  const search = q
    ? or(
        ilike(threads.subject, `%${q}%`),
        ilike(threads.contactEmail, `%${q}%`),
        ilike(threads.contactName, `%${q}%`),
        sql`exists (select 1 from ${messages} where ${messages.threadId} = ${threads.id} and ${messages.text} ilike ${`%${q}%`})`,
      )
    : undefined;
  const page = Math.max(0, opts.page ?? 0);
  const rows = await db()
    .select({
      id: threads.id,
      subject: threads.subject,
      contactEmail: threads.contactEmail,
      contactName: threads.contactName,
      status: threads.status,
      starred: threads.starred,
      unread: threads.unread,
      snippet: threads.snippet,
      messageCount: threads.messageCount,
      lastMessageAt: threads.lastMessageAt,
      assigneeName: user.name,
      maker: isMaker,
    })
    .from(threads)
    .leftJoin(user, eq(user.id, threads.assigneeId))
    .where(and(folderWhere(opts.folder, opts.me), search))
    .orderBy(desc(threads.lastMessageAt))
    .limit(PAGE_SIZE + 1)
    .offset(page * PAGE_SIZE);
  return { rows: rows.slice(0, PAGE_SIZE), more: rows.length > PAGE_SIZE };
}

/** Sidebar numbers: unread in the inbox, open threads assigned to me or nobody, and spam. */
export async function folderCounts(me: string) {
  const [row] = await db()
    .select({
      inbox: count(sql`case when ${threads.status} = 'open' and ${threads.unread} then 1 end`),
      mine: count(sql`case when ${threads.status} = 'open' and ${threads.assigneeId} = ${me} then 1 end`),
      unassigned: count(sql`case when ${threads.status} = 'open' and ${threads.assigneeId} is null then 1 end`),
      spam: count(sql`case when ${threads.status} = 'spam' then 1 end`),
    })
    .from(threads);
  return row ?? { inbox: 0, mine: 0, unassigned: 0, spam: 0 };
}

/** Who the contact is on DebutYard, for the card beside the conversation. */
async function customerFor(email: string) {
  const account = await db().query.user.findFirst({ where: eq(sql`lower(${user.email})`, email) });
  if (!account) return null;
  const [owned, [paid], subs] = await Promise.all([
    db()
      .select({
        id: products.id,
        name: products.name,
        slug: products.slug,
        tier: products.tier,
        status: products.status,
      })
      .from(products)
      .where(eq(products.createdBy, account.id))
      .orderBy(desc(products.createdAt))
      .limit(10),
    db()
      .select({ n: count() })
      .from(schema.orders)
      .where(and(eq(schema.orders.userId, account.id), eq(schema.orders.status, "paid"))),
    db()
      .select({ sku: schema.subscriptions.sku, status: schema.subscriptions.status })
      .from(schema.subscriptions)
      .where(
        and(
          eq(schema.subscriptions.userId, account.id),
          inArray(schema.subscriptions.status, ["active", "non_renewing", "past_due"]),
        ),
      ),
  ]);
  return {
    id: account.id,
    name: account.name,
    email: account.email,
    joinedAt: account.createdAt,
    products: owned,
    paidOrders: paid?.n ?? 0,
    subscriptions: subs,
  };
}

export async function getThread(id: string) {
  const thread = await db().query.supportThreads.findFirst({ where: eq(threads.id, id) });
  if (!thread) return null;
  const [rows, customer] = await Promise.all([
    db()
      .select({ m: messages, authorName: user.name })
      .from(messages)
      .leftJoin(user, eq(user.id, messages.authorId))
      .where(eq(messages.threadId, id))
      .orderBy(asc(messages.createdAt)),
    customerFor(thread.contactEmail),
  ]);
  return {
    thread,
    messages: rows.map((r) => ({ ...r.m, authorName: r.authorName })),
    customer,
    maker: Boolean(customer?.products.length),
  };
}

export async function setUnread(ids: string[], unread: boolean) {
  if (ids.length) await db().update(threads).set({ unread }).where(inArray(threads.id, ids));
}

export async function setStatus(ids: string[], status: Thread["status"]) {
  if (!ids.length) return;
  // Leaving the inbox marks the conversation read, as in Gmail.
  await db()
    .update(threads)
    .set(status === "open" ? { status } : { status, unread: false })
    .where(inArray(threads.id, ids));
}

export async function setStarred(id: string, starred: boolean) {
  await db().update(threads).set({ starred }).where(eq(threads.id, id));
}

export async function assign(id: string, assigneeId: string | null) {
  await db().update(threads).set({ assigneeId }).where(eq(threads.id, id));
}

export type ComposeInput = {
  mode: "new" | "reply" | "replyAll" | "forward";
  threadId?: string;
  to: string[];
  cc: string[];
  subject: string;
  body: string;
};
export type Author = { id: string; name: string };

const supportFrom = () => `${site.name} Support <${site.supportEmail}>`;
/** "— Henry, DebutYard": hand-written email is signed by whoever wrote it. */
export const signOffFor = (name: string) => `— ${name.trim().split(/\s+/)[0] || "The team"}, ${site.name}`;

/** The last message of a thread, which a reply quotes and answers. */
async function lastMessage(threadId: string): Promise<Message | null> {
  const [m] = await db()
    .select()
    .from(messages)
    .where(eq(messages.threadId, threadId))
    .orderBy(desc(messages.createdAt))
    .limit(1);
  return m ?? null;
}

function renderCompose(input: ComposeInput, author: Author, quoted: Message | null): RenderedEmail {
  const blocks = bodyToBlocks(input.body);
  if (quoted) {
    const who = quoted.fromName ? `${quoted.fromName} <${quoted.fromAddress}>` : quoted.fromAddress;
    blocks.push({
      cite:
        input.mode === "forward"
          ? `Forwarded message. ${quoteCite(quoted.createdAt, who)}`
          : quoteCite(quoted.createdAt, who),
      quote: quoted.text.trim().slice(0, 20_000),
    });
  }
  return renderEmail({
    variant: "customer",
    label: "Support",
    subject: input.subject,
    reason: "a member of the DebutYard team wrote to you",
    signOff: signOffFor(author.name),
    blocks,
  });
}

/** The email as the recipient will see it, for the composer's preview. */
export async function previewSupportEmail(input: ComposeInput, author: Author): Promise<RenderedEmail> {
  const quoted = input.mode !== "new" && input.threadId ? await lastMessage(input.threadId) : null;
  return renderCompose(input, author, quoted);
}

/**
 * Sends hand-written email from support@ through the branded template and
 * files it in its thread (a new one for "new"). Replies come back to the
 * thread's support+key@ address.
 */
export async function sendSupportEmail(input: ComposeInput, author: Author, now = new Date()) {
  const to = [...new Set(input.to.map((a) => parseAddress(a).email))].filter(Boolean);
  const cc = [...new Set(input.cc.map((a) => parseAddress(a).email))].filter((a) => a && !to.includes(a));
  if (!to.length) throw new Error("Add a recipient.");

  let thread: Thread | undefined;
  if (input.mode !== "new") {
    if (!input.threadId) throw new Error("Missing conversation.");
    thread = await db().query.supportThreads.findFirst({ where: eq(threads.id, input.threadId) });
    if (!thread) throw new Error("That conversation no longer exists.");
  }
  const quoted = thread ? await lastMessage(thread.id) : null;
  const rendered = renderCompose(input, author, quoted);
  const replyKey = thread?.replyKey ?? newReplyKey();
  const headers: Record<string, string> = {};
  if (input.mode !== "forward" && quoted?.messageId) {
    headers["In-Reply-To"] = quoted.messageId;
    headers.References = [quoted.references, quoted.messageId].filter(Boolean).join(" ").slice(-2000);
  }

  const resendId = await sendEmail({
    from: supportFrom(),
    to: to[0],
    cc: [...to.slice(1), ...cc],
    replyTo: replyAddress(replyKey, site.supportEmail),
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    headers: Object.keys(headers).length ? headers : undefined,
    tags: [{ name: "kind", value: "support" }],
  });

  return db().transaction(async (tx) => {
    if (!thread) {
      [thread] = await tx
        .insert(threads)
        .values({
          replyKey,
          subject: input.subject.slice(0, 1000),
          contactEmail: to[0],
          status: "open",
          unread: false,
          assigneeId: author.id,
          lastMessageAt: now,
          createdAt: now,
        })
        .returning();
    }
    const [row] = await tx
      .insert(messages)
      .values({
        threadId: thread.id,
        direction: "out",
        fromAddress: site.supportEmail,
        fromName: `${author.name} (${site.name})`,
        toAddresses: to,
        ccAddresses: cc,
        subject: rendered.subject,
        text: input.body,
        html: rendered.html,
        inReplyTo: headers["In-Reply-To"] ?? null,
        references: headers.References ?? null,
        resendEmailId: resendId,
        authorId: author.id,
        createdAt: now,
      })
      .returning({ id: messages.id });
    await tx
      .update(threads)
      .set({
        unread: false,
        // Writing from spam or trash brings the conversation back.
        status: sql`case when ${threads.status} = 'done' then 'done'::support_status else 'open'::support_status end`,
        snippet: snippetFrom(input.body),
        messageCount: sql`${threads.messageCount} + 1`,
        lastMessageAt: now,
        // Replying to an unassigned conversation takes it.
        assigneeId: sql`coalesce(${threads.assigneeId}, ${author.id})`,
      })
      .where(eq(threads.id, thread.id));
    return { threadId: thread.id, messageId: row.id };
  });
}

/** A short-lived download link for a received attachment. */
export async function attachmentUrl(messageId: string, attachmentId: string): Promise<string | null> {
  const message = await db().query.supportMessages.findFirst({ where: eq(messages.id, messageId) });
  if (!message?.resendEmailId || !message.attachments.some((a) => a.id === attachmentId)) return null;
  const r = resendClient();
  if (!r) return null;
  const { data, error } = await r.emails.receiving.attachments.get({
    emailId: message.resendEmailId,
    id: attachmentId,
  });
  if (error) throw new Error(`Couldn't load attachment: ${error.message}`);
  return data?.download_url ?? null;
}

/** Everyone who can be assigned a conversation. */
export async function staffMembers() {
  return db()
    .select({ id: user.id, name: user.name })
    .from(user)
    .innerJoin(schema.adminUsers, eq(schema.adminUsers.email, sql`lower(${user.email})`))
    .orderBy(asc(user.name));
}
