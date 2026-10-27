/**
 * The launch wall against a real Postgres: opt-in only, and only links our
 * checks found live. Runs when TEST_DATABASE_URL is set; the database is wiped.
 */
import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resetDatabase } from "./helpers/db";

const TEST_DB = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_DB)("launch wall (Postgres)", () => {
  let dbmod: typeof import("@/db");
  let wall: typeof import("@/lib/links/wall");

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB;
    await resetDatabase(TEST_DB!);
    dbmod = await import("@/db");
    wall = await import("@/lib/links/wall");
  });

  afterAll(async () => {
    await (dbmod?.db() as unknown as { $client: { end(): Promise<void> } } | undefined)?.$client.end();
  });

  it("shows opted-in makers with only machine-verified live links", async () => {
    const { db, schema } = dbmod;
    await db().execute(sql`truncate tracked_links, launch_wall_profiles, "user" cascade`);
    await db()
      .insert(schema.user)
      .values([
        { id: "a", name: "Ada", email: "a@x.test", handle: "ada" },
        { id: "b", name: "Bo", email: "b@x.test", handle: "bo" },
      ]);
    const now = new Date();
    const link = (owner: string, url: string, verdict: "dofollow" | "nofollow" | "missing" | null, active = true) => ({
      ownerUserId: owner,
      url,
      targetDomain: "acme.io",
      source: "manual" as const,
      lastVerdict: verdict,
      lastCheckedAt: verdict ? now : null,
      active,
    });
    await db()
      .insert(schema.trackedLinks)
      .values([
        link("a", "https://d1.test/a", "dofollow"),
        link("a", "https://d2.test/a", "dofollow"),
        link("a", "https://d3.test/a", "nofollow"),
        link("a", "https://d4.test/a", "missing"),
        link("a", "https://d5.test/a", null),
        link("a", "https://d6.test/a", "dofollow", false),
        link("b", "https://d1.test/b", "dofollow"),
      ]);

    expect(await wall.launchWall()).toEqual([]);
    await wall.setLaunchWall("a", true);
    await wall.setLaunchWall("a", true);
    expect(await wall.onLaunchWall("a")).toBe(true);

    const rows = await wall.launchWall();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ handle: "ada", dofollow: 2, total: 3, domains: ["acme.io"] });
    expect((await wall.wallLinks("a")).map((l) => [l.url, l.verdict])).toEqual([
      ["https://d1.test/a", "dofollow"],
      ["https://d2.test/a", "dofollow"],
      ["https://d3.test/a", "nofollow"],
    ]);

    await wall.setLaunchWall("b", true);
    expect((await wall.launchWall()).map((r) => r.handle)).toEqual(["ada", "bo"]);
    await wall.setLaunchWall("a", false);
    expect((await wall.launchWall()).map((r) => r.handle)).toEqual(["bo"]);
  });
});
