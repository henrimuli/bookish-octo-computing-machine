import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

/**
 * Who can open /admin. Keyed by email so someone can be added before they sign
 * up. ADMIN_EMAIL is always the owner (added on first visit). `role` is
 * stored for the permissions to come; every role has full access for now.
 */
export const adminUsers = pgTable("admin_users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  role: text("role", { enum: ["owner", "admin", "ops"] })
    .notNull()
    .default("admin"),
  addedByUserId: text("added_by_user_id").references(() => user.id, { onDelete: "set null" }),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** One row per cron run, so the admin dashboard can show failures and stale jobs. */
export const cronRuns = pgTable(
  "cron_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    job: text("job").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    /** Task names that threw. */
    failed: text("failed").array().notNull().default([]),
    results: jsonb("results"),
  },
  (t) => [index("cron_runs_job_idx").on(t.job, t.startedAt)],
);
