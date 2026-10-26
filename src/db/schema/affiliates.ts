import { index, integer, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";
import { orders } from "./payments";

export const affiliateStatus = pgEnum("affiliate_status", ["active", "suspended"]);
export const referralStatus = pgEnum("referral_status", ["pending", "approved", "paid", "void"]);

/** Makers who earn a commission on sales they refer (PLAN §5.5). Paid out by hand via PayPal. */
export const affiliates = pgTable("affiliates", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  /** Used as ?via=<code>. */
  code: text("code").notNull().unique(),
  payoutEmail: text("payout_email").notNull(),
  ratePct: integer("rate_pct").notNull().default(30),
  status: affiliateStatus("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** One commission per referred order. Approved after the 30-day refund window; void on a full refund. */
export const affiliateReferrals = pgTable(
  "affiliate_referrals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    affiliateId: uuid("affiliate_id")
      .notNull()
      .references(() => affiliates.id, { onDelete: "cascade" }),
    orderId: uuid("order_id")
      .notNull()
      .unique()
      .references(() => orders.id, { onDelete: "cascade" }),
    commissionCents: integer("commission_cents").notNull(),
    status: referralStatus("status").notNull().default("pending"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("affiliate_referrals_affiliate_idx").on(t.affiliateId, t.status)],
);
