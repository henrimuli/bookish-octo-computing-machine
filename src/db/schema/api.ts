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
    /** Set when the token came from the browser-approval (OAuth) flow for this client. */
    clientId: text("client_id").references(() => oauthClients.id, { onDelete: "set null" }),
  },
  (t) => [index("api_tokens_user_idx").on(t.userId)],
);

/** MCP clients registered through OAuth dynamic client registration (RFC 7591). Public clients: no secret. */
export const oauthClients = pgTable("oauth_clients", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  redirectUris: text("redirect_uris").array().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** One-time authorization codes (5 minutes, PKCE S256). Only a hash is stored. */
export const oauthCodes = pgTable(
  "oauth_codes",
  {
    codeHash: text("code_hash").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClients.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    redirectUri: text("redirect_uri").notNull(),
    codeChallenge: text("code_challenge").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("oauth_codes_client_idx").on(t.clientId)],
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

/** Free tool runs (dofollow checker, DR checker): per-tool hourly rate limits. */
export const toolChecks = pgTable(
  "tool_checks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tool: text("tool").notNull(),
    target: text("target").notNull(),
    /** Salted hash of the caller's IP or account, as for readiness checks. */
    clientHash: text("client_hash").notNull(),
    source: text("source").notNull().default("web"),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("tool_checks_client_idx").on(t.tool, t.clientHash, t.createdAt)],
);
