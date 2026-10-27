/**
 * The free dofollow and DR checkers against a real Postgres, with fetches and
 * the DR provider faked: verdicts, per-tool rate limits, the DR cache and the
 * MCP tools hiding check_dr without a provider. Runs when TEST_DATABASE_URL is set.
 */
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { DrProvider } from "@/lib/metrics/providers";
import { resetDatabase } from "./helpers/db";

const TEST_DB = process.env.TEST_DATABASE_URL;

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(async () => {}),
  sendBatch: vi.fn(async (emails: unknown[]) => emails.length),
}));

const pages = new Map<string, { status: number; body: string }>();
vi.mock("@/lib/net", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/net")>();
  return {
    ...actual,
    safeFetchText: vi.fn(async (url: string) => {
      const page = pages.get(url);
      if (!page) throw new Error("connect ECONNREFUSED");
      return { url, status: page.status, contentType: "text/html", body: page.body };
    }),
  };
});

const drCalls: string[] = [];
const fakeDr: DrProvider = {
  id: "openpagerank",
  async fetchDr(domain) {
    drCalls.push(domain);
    return { dr: 42, referringDomains: 310 };
  },
};

describe.skipIf(!TEST_DB)("free tools (Postgres)", () => {
  let dbmod: typeof import("@/db");
  let tools: typeof import("@/lib/tools/service");
  let metrics: typeof import("@/lib/metrics/service");
  let mcp: typeof import("@/lib/api/mcp");
  const web = (ip: string) => ({ clientKey: ip, source: "web" as const });

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB;
    process.env.NEXT_PUBLIC_SITE_URL = "https://debutyard.test";
    await resetDatabase(TEST_DB!);
    dbmod = await import("@/db");
    tools = await import("@/lib/tools/service");
    metrics = await import("@/lib/metrics/service");
    mcp = await import("@/lib/api/mcp");
  });

  afterAll(async () => {
    metrics?.setDrProviderForTests(undefined);
    await (dbmod?.db() as unknown as { $client: { end(): Promise<void> } } | undefined)?.$client.end();
  });

  beforeEach(async () => {
    pages.clear();
    drCalls.length = 0;
    metrics.setDrProviderForTests(null);
    await dbmod.db().execute(sql`truncate tool_checks, domain_metrics`);
  });

  it("reports dofollow, nofollow, missing and unreachable, and rate limits per tool", async () => {
    pages.set("https://dir.test/a", { status: 200, body: '<a href="https://www.acme.io/">Acme</a>' });
    pages.set("https://dir.test/b", { status: 200, body: '<a rel="nofollow ugc" href="https://acme.io">Acme</a>' });
    pages.set("https://dir.test/c", { status: 200, body: "<p>nothing here</p>" });
    pages.set("https://dir.test/d", { status: 404, body: "" });

    expect(await tools.checkDofollow("dir.test/a", "https://acme.io/pricing", web("1.1.1.1"))).toMatchObject({
      pageUrl: "https://dir.test/a",
      domain: "acme.io",
      verdict: "dofollow",
      anchor: "Acme",
    });
    expect(await tools.checkDofollow("https://dir.test/b", "acme.io", web("1.1.1.1"))).toMatchObject({
      verdict: "nofollow",
      rel: "nofollow ugc",
    });
    expect((await tools.checkDofollow("https://dir.test/c", "acme.io", web("1.1.1.1"))).verdict).toBe("missing");
    const down = await tools.checkDofollow("https://dir.test/d", "acme.io", web("1.1.1.1"));
    expect(down).toMatchObject({ verdict: "unreachable", httpStatus: 404 });
    expect(down.explanation).toContain("404");

    await expect(tools.checkDofollow("https://dir.test/a", "localhost", web("1.1.1.1"))).rejects.toThrow("example.com");

    for (let i = 4; i < tools.TOOL_RUNS_PER_HOUR; i++) {
      await tools.checkDofollow("https://dir.test/a", "acme.io", web("1.1.1.1"));
    }
    await expect(tools.checkDofollow("https://dir.test/a", "acme.io", web("1.1.1.1"))).rejects.toMatchObject({
      rateLimited: true,
    });
    // Other callers, and other tools, have their own allowance.
    await tools.checkDofollow("https://dir.test/a", "acme.io", web("2.2.2.2"));
    metrics.setDrProviderForTests(fakeDr);
    expect((await tools.checkDr("acme.io", web("1.1.1.1"))).dr).toBe(42);
  });

  it("checks DR through the 7-day cache, and hides itself without a provider", async () => {
    await expect(tools.checkDr("acme.io", web("1.1.1.1"))).rejects.toThrow("isn't available");
    const names = () => (mcp.TOOLS.filter((t) => t.enabled?.() ?? true) as Array<{ name: string }>).map((t) => t.name);
    expect(names()).toContain("check_dofollow");
    expect(names()).not.toContain("check_dr");

    metrics.setDrProviderForTests(fakeDr);
    expect(names()).toContain("check_dr");
    expect(await tools.checkDr("https://www.acme.io/x", web("1.1.1.1"))).toMatchObject({
      domain: "acme.io",
      dr: 42,
      referringDomains: 310,
      provider: "openpagerank",
    });
    await tools.checkDr("acme.io", web("1.1.1.1"));
    expect(drCalls).toEqual(["acme.io"]);
  });
});
