import { index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { products } from "./board";
import { orders } from "./payments";

export const postStatus = pgEnum("post_status", ["draft", "published"]);
export const postKind = pgEnum("post_kind", ["post", "recap", "launch"]);

/**
 * Blog posts. Weekly recaps are drafted automatically (one per week) and published by hand.
 * Launch posts are drafted from a paid debut's perk task (see perkTasks).
 */
export const posts = pgTable(
  "posts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    excerpt: text("excerpt").notNull().default(""),
    /** Markdown. Raw HTML is escaped when rendered. */
    body: text("body").notNull().default(""),
    coverUrl: text("cover_url"),
    kind: postKind("kind").notNull().default("post"),
    /** Set on recaps: the week they cover. Unique so the cron drafts each week once. */
    weekKey: text("week_key").unique(),
    status: postStatus("status").notNull().default("draft"),
    authorId: text("author_id").references(() => user.id, { onDelete: "set null" }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [index("posts_published_idx").on(t.status, t.publishedAt)],
);

export const perkKind = pgEnum("perk_kind", ["newsletter", "newsletter_top", "launch_post"]);
export const perkStatus = pgEnum("perk_status", ["suggested", "drafting", "done", "skipped"]);

/**
 * Perks a paid debut bought that the team delivers: a newsletter mention (Pro,
 * Premium), the top newsletter slot (Spotlight) and a written launch post
 * (Premium, Spotlight). Created when the order is paid; shown as suggestions
 * on the admin Newsletter and Blog pages.
 */
export const perkTasks = pgTable(
  "perk_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    kind: perkKind("kind").notNull(),
    status: perkStatus("status").notNull().default("suggested"),
    /**
     * Newsletter mentions: the issue they go in, keyed like newsletter_issues
     * (the week that closed; the issue's "Debuting now" week is the one after).
     * Once delivered, the issue they went out in. Launch posts: the launch week.
     */
    weekKey: text("week_key").notNull(),
    /** Newsletter line; the tagline is used when null. */
    blurb: text("blurb"),
    /** Launch posts: the draft (or published post) written for it. */
    postId: uuid("post_id").references(() => posts.id, { onDelete: "set null" }),
    skipReason: text("skip_reason"),
    /** Launch posts: end of the launch week (Spotlight: 7 days after payment). */
    dueAt: timestamp("due_at", { withTimezone: true }),
    doneAt: timestamp("done_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // A redelivered payment webhook can't create the same perk twice.
    uniqueIndex("perk_tasks_order_kind_idx").on(t.orderId, t.kind),
    index("perk_tasks_status_kind_idx").on(t.status, t.kind),
    index("perk_tasks_product_idx").on(t.productId),
  ],
);
