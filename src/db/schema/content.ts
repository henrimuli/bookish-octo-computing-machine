import { index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const postStatus = pgEnum("post_status", ["draft", "published"]);
export const postKind = pgEnum("post_kind", ["post", "recap"]);

/** Blog posts. Weekly recaps are drafted automatically (one per week) and published by hand. */
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
