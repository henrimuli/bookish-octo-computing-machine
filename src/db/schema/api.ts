import { index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "./auth";

/** Personal API tokens for the REST API and MCP server. Only a SHA-256 hash is stored. */
export const apiTokens = pgTable(
  "api_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    /** First characters, shown so people can tell tokens apart. */
    prefix: text("prefix").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [index("api_tokens_user_idx").on(t.userId)],
);

/** Launch-readiness runs: rate limiting and readiness → submit conversion. */
export const readinessChecks = pgTable(
  "readiness_checks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    domain: text("domain").notNull(),
    score: integer("score").notNull(),
    /** Salted hash of the caller's IP, for rate limiting. */
    clientHash: text("client_hash").notNull(),
    source: text("source").notNull().default("web"),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("readiness_client_idx").on(t.clientHash, t.createdAt)],
);
