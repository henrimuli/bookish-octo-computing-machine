import "server-only";
import { z } from "zod";

/**
 * Server environment. Parsed lazily so `next build` works without secrets;
 * each integration asserts the variables it needs at call time.
 */
const optional = z
  .string()
  .optional()
  .transform((v) => (v === "" ? undefined : v));

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_SITE_URL: z.string().url().default("http://localhost:3000"),

  // Database (Supabase). DATABASE_URL = transaction pooler (port 6543),
  // DIRECT_DATABASE_URL = direct/session connection used for migrations.
  DATABASE_URL: optional,
  DIRECT_DATABASE_URL: optional,

  // Auth
  BETTER_AUTH_SECRET: optional,
  GOOGLE_CLIENT_ID: optional,
  GOOGLE_CLIENT_SECRET: optional,
  GITHUB_CLIENT_ID: optional,
  GITHUB_CLIENT_SECRET: optional,

  // Email
  RESEND_API_KEY: optional,
  EMAIL_FROM: z.string().default("DebutYard <hello@debutyard.com>"),
  /** Where order notifications go. Defaults to the support address. */
  ADMIN_EMAIL: optional,

  // Payments
  PAYSTACK_SECRET_KEY: optional,
  PAYPAL_CLIENT_ID: optional,
  PAYPAL_CLIENT_SECRET: optional,
  PAYPAL_WEBHOOK_ID: optional,
  PAYPAL_ENV: z.enum(["sandbox", "live"]).default("sandbox"),

  // Storage (Cloudflare R2)
  R2_ACCOUNT_ID: optional,
  R2_ACCESS_KEY_ID: optional,
  R2_SECRET_ACCESS_KEY: optional,
  R2_BUCKET: optional,
  R2_PUBLIC_URL: optional,

  // Domain Rating provider for DR snapshots and the DR checker. Unset hides the features.
  DR_PROVIDER: z.enum(["dataforseo", "ahrefs", "openpagerank"]).optional().catch(undefined),
  /** DataForSEO: "login:password". Ahrefs: an API v3 key. Open PageRank: its API key. */
  DR_API_KEY: optional,

  // Submission ops. Inbound mail ({key}@INBOUND_EMAIL_DOMAIN) is POSTed to /api/inbound signed with INBOUND_SECRET.
  INBOUND_EMAIL_DOMAIN: optional,
  INBOUND_SECRET: optional,
  /** 32 random bytes, base64. Encrypts directory account passwords. */
  CREDENTIALS_KEY: optional,

  // Vercel Cron sends this as a bearer token.
  CRON_SECRET: optional,
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  cached ??= schema.parse(process.env);
  return cached;
}

/** Returns the named variables or throws a single, readable error listing the missing ones. */
export function requireEnv<K extends keyof Env>(...keys: K[]): { [P in K]: NonNullable<Env[P]> } {
  const e = env();
  const missing = keys.filter((k) => e[k] === undefined || e[k] === "");
  if (missing.length > 0) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  }
  return Object.fromEntries(keys.map((k) => [k, e[k]])) as { [P in K]: NonNullable<Env[P]> };
}

/** Test-only: reset the memoized env after mutating process.env. */
export function resetEnvForTests() {
  cached = undefined;
}
