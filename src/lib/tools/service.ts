import "server-only";
import { and, count, eq, gt, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { checkLink } from "@/lib/directories/verify";
import { drEnabled, drFor } from "@/lib/metrics/service";
import { hashClient, normalizeUrl, ReadinessError } from "@/lib/readiness/service";
import { explainLink, toDomain } from "./explain";

export class ToolError extends Error {
  constructor(
    message: string,
    readonly rateLimited = false,
  ) {
    super(message);
  }
}

/** Each caller can run each free tool this many times an hour (same as the readiness check). */
export const TOOL_RUNS_PER_HOUR = 15;

export type ToolCaller = { clientKey: string; userId?: string | null; source: "web" | "api" | "mcp" };
type Tool = "dofollow" | "dr" | "screenshot";

/** Counts the run against the caller's hourly allowance, or throws when it's used up. */
export async function spend(
  tool: Tool,
  target: string,
  caller: ToolCaller,
  limit = TOOL_RUNS_PER_HOUR,
  now = new Date(),
) {
  const clientHash = hashClient(caller.userId ? `user:${caller.userId}` : `ip:${caller.clientKey}`);
  const since = new Date(now.getTime() - 3600_000).toISOString();
  const [{ n }] = await db()
    .select({ n: count() })
    .from(schema.toolChecks)
    .where(
      and(
        eq(schema.toolChecks.tool, tool),
        eq(schema.toolChecks.clientHash, clientHash),
        gt(schema.toolChecks.createdAt, sql`${since}::timestamptz`),
      ),
    );
  if (n >= limit) throw new ToolError("That's a lot of checks. Try again in an hour.", true);
  await db()
    .insert(schema.toolChecks)
    .values({ tool, target, clientHash, source: caller.source, userId: caller.userId ?? null });
}

function domainOrThrow(raw: string, what: string) {
  try {
    return toDomain(raw);
  } catch {
    throw new ToolError(`Enter ${what}, like example.com.`);
  }
}

/** Does `pageUrl` link to `target` (a domain or URL), and is the link followed? */
export async function checkDofollow(pageUrl: string, target: string, caller: ToolCaller) {
  let url: string;
  try {
    url = normalizeUrl(pageUrl);
  } catch (err) {
    if (err instanceof ReadinessError)
      throw new ToolError("Enter the page to check, like https://example.com/listing.");
    throw err;
  }
  const domain = domainOrThrow(target, "the site the link should point to");
  await spend("dofollow", url, caller);
  const r = await checkLink(url, domain);
  return {
    pageUrl: url,
    domain,
    verdict: r.verdict,
    rel: r.rel,
    anchor: r.anchor,
    httpStatus: r.httpStatus,
    explanation: explainLink(r, domain),
  };
}

/** A domain's DR from the configured provider, cached for 7 days. */
export async function checkDr(rawDomain: string, caller: ToolCaller) {
  if (!drEnabled()) throw new ToolError("The DR checker isn't available right now.");
  const domain = domainOrThrow(rawDomain, "a domain");
  await spend("dr", domain, caller);
  const row = await drFor(domain).catch((err) => {
    console.error("DR check failed", err);
    return null;
  });
  if (!row) throw new ToolError(`We couldn't get a rating for ${domain}. Try again later.`);
  return {
    domain,
    dr: row.dr,
    referringDomains: row.referringDomains,
    provider: row.provider,
    measuredAt: row.measuredAt.toISOString(),
  };
}
