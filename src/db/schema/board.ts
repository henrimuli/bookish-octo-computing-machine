import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "./auth";
import { orders } from "./payments";

/** ISO week, e.g. "2026-W44". Weeks run Monday 00:00 UTC → next Monday 00:00 UTC. */
export const launchWeeks = pgTable("launch_weeks", {
  key: text("key").primaryKey(),
  startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
  endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
  /** How many free debuts this week can take. Paid debuts don't count. */
  freeCapacity: integer("free_capacity").notNull().default(30),
  /** Set when the week is closed and winners are awarded. */
  closedAt: timestamp("closed_at", { withTimezone: true }),
});

export const categories = pgTable("categories", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  position: integer("position").notNull().default(0),
});

export const productStatus = pgEnum("product_status", [
  "draft", // being edited by the maker
  "pending", // submitted, waiting for review
  "approved", // scheduled into launch_week_key (live once that week starts)
  "rejected",
  "archived",
]);

export const productTier = pgEnum("product_tier", ["free", "fast_track", "pro", "premium", "spotlight"]);

export const pricingModel = pgEnum("pricing_model", ["free", "freemium", "paid", "open_source", "trial"]);

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    tagline: text("tagline").notNull(),
    description: text("description").notNull().default(""),
    websiteUrl: text("website_url").notNull(),
    /** Normalised hostname, used for duplicate detection and badge checks. */
    domain: text("domain").notNull(),
    logoUrl: text("logo_url"),
    pricingModel: pricingModel("pricing_model").notNull().default("freemium"),
    twitterUrl: text("twitter_url"),
    githubUrl: text("github_url"),
    status: productStatus("status").notNull().default("draft"),
    tier: productTier("tier").notNull().default("free"),
    /** Week the maker asked for (paid tiers), then the week they're scheduled into. */
    requestedWeekKey: text("requested_week_key"),
    launchWeekKey: text("launch_week_key").references(() => launchWeeks.key),
    rejectionReason: text("rejection_reason"),
    /** Weekly top 3 keep a followed link regardless of badge. */
    isWinner: boolean("is_winner").notNull().default(false),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (t) => [
    index("products_status_week_idx").on(t.status, t.launchWeekKey),
    index("products_created_by_idx").on(t.createdBy),
    index("products_domain_idx").on(t.domain),
  ],
);

export const productCategories = pgTable(
  "product_categories",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    categorySlug: text("category_slug")
      .notNull()
      .references(() => categories.slug, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.productId, t.categorySlug] }),
    index("product_categories_cat_idx").on(t.categorySlug),
  ],
);

export const productMedia = pgTable("product_media", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  position: integer("position").notNull().default(0),
});

export const votes = pgTable(
  "votes",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** Ranking weight: new or suspicious accounts count for less. Shown counts ignore it. */
    weight: real("weight").notNull().default(1),
    ipHash: text("ip_hash"),
    uaHash: text("ua_hash"),
    flagged: boolean("flagged").notNull().default(false),
    flagReason: text("flag_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.productId, t.userId] }),
    index("votes_user_created_idx").on(t.userId, t.createdAt),
    index("votes_ip_created_idx").on(t.ipHash, t.createdAt),
  ],
);

export const commentStatus = pgEnum("comment_status", ["visible", "hidden", "deleted"]);

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),
    body: text("body").notNull(),
    status: commentStatus("status").notNull().default("visible"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("comments_product_idx").on(t.productId, t.createdAt)],
);

export const awardScope = pgEnum("award_scope", ["week", "month", "year"]);

export const awards = pgTable(
  "awards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    scope: awardScope("scope").notNull(),
    /** "2026-W44", "2026-10" or "2026". */
    periodKey: text("period_key").notNull(),
    place: integer("place").notNull(),
    score: real("score").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("awards_period_place_idx").on(t.scope, t.periodKey, t.place),
    index("awards_product_idx").on(t.productId),
  ],
);

export const badgeStatus = pgEnum("badge_status", ["unverified", "verified", "grace", "missing"]);
export const badgeMethod = pgEnum("badge_method", ["html", "dns"]);

export const badgeVerifications = pgTable("badge_verifications", {
  productId: uuid("product_id")
    .primaryKey()
    .references(() => products.id, { onDelete: "cascade" }),
  status: badgeStatus("status").notNull().default("unverified"),
  method: badgeMethod("method"),
  /** Token for the DNS TXT fallback: debutyard-verification=<token>. */
  dnsToken: text("dns_token").notNull(),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  graceUntil: timestamp("grace_until", { withTimezone: true }),
  failureReason: text("failure_reason"),
});

export const eventKind = pgEnum("event_kind", ["view", "outbound_click"]);

/** Raw maker-facing analytics. Aggregated on read; prune or roll up later. */
export const productEvents = pgTable(
  "product_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    kind: eventKind("kind").notNull(),
    referrer: text("referrer"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("product_events_product_kind_idx").on(t.productId, t.kind, t.createdAt)],
);

/** Links a paid launch order to its product (an order can only pay for one product). */
export const productOrders = pgTable(
  "product_orders",
  {
    orderId: uuid("order_id")
      .primaryKey()
      .references(() => orders.id),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
  },
  (t) => [index("product_orders_product_idx").on(t.productId)],
);
