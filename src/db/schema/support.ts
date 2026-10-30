import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const supportStatus = pgEnum("support_status", ["open", "done", "spam", "trash"]);
export const supportDirection = pgEnum("support_direction", ["in", "out"]);

/** One conversation in the shared support inbox (support@). */
export const supportThreads = pgTable(
  "support_threads",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Short random key in our reply address (support+{key}@), so replies find their thread. */
    replyKey: text("reply_key").notNull().unique(),
    subject: text("subject").notNull().default(""),
    /** The customer's side of the conversation. */
    contactEmail: text("contact_email").notNull(),
    contactName: text("contact_name"),
    status: supportStatus("status").notNull().default("open"),
    starred: boolean("starred").notNull().default(false),
    /** Unread for staff: a customer message arrived since anyone opened the thread. */
    unread: boolean("unread").notNull().default(true),
    assigneeId: text("assignee_id").references(() => user.id, { onDelete: "set null" }),
    snippet: text("snippet").notNull().default(""),
    messageCount: integer("message_count").notNull().default(0),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("support_threads_status_idx").on(t.status, t.lastMessageAt),
    index("support_threads_contact_idx").on(t.contactEmail),
  ],
);

export type SupportAttachment = {
  /** Resend's attachment id; the file is fetched from Resend when opened. */
  id: string;
  filename: string | null;
  size: number;
  contentType: string;
};

/** A message in a support thread: received from a customer, or written by staff. */
export const supportMessages = pgTable(
  "support_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => supportThreads.id, { onDelete: "cascade" }),
    direction: supportDirection("direction").notNull(),
    fromAddress: text("from_address").notNull(),
    fromName: text("from_name"),
    toAddresses: text("to_addresses").array().notNull().default([]),
    ccAddresses: text("cc_addresses").array().notNull().default([]),
    subject: text("subject").notNull().default(""),
    text: text("text").notNull().default(""),
    html: text("html"),
    /** RFC Message-ID, angle brackets included; In-Reply-To/References point at these. */
    messageId: text("message_id"),
    inReplyTo: text("in_reply_to"),
    references: text("references"),
    attachments: jsonb("attachments").$type<SupportAttachment[]>().notNull().default([]),
    /** Resend's id: the received email (makes redelivered webhooks no-ops) or the sent one. */
    resendEmailId: text("resend_email_id").unique(),
    /** Staff member who wrote an outgoing message. */
    authorId: text("author_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("support_messages_thread_idx").on(t.threadId, t.createdAt),
    index("support_messages_message_id_idx").on(t.messageId),
  ],
);
