/**
 * Admin access and the admin dashboard against a real Postgres: ADMIN_EMAIL
 * works for accounts created before it was set, admin_users grants and
 * revokes access, the overview queries run, and cron runs are logged.
 */
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { resetDatabase } from "./helpers/db";

const TEST_DB = process.env.TEST_DATABASE_URL;

vi.mock("@/lib/email", () => ({ sendEmail: vi.fn(), sendBatch: vi.fn(), resendClient: () => null }));

describe.skipIf(!TEST_DB)("admin (Postgres)", () => {
  let dbmod: typeof import("@/db");
  let auth: typeof import("@/lib/auth");
  let admins: typeof import("@/lib/admin/users");
  let overview: typeof import("@/lib/admin/overview");

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB;
    process.env.ADMIN_EMAIL = " Owner@DebutYard.test ";
    process.env.CRON_SECRET = "cron-secret";
    (await import("@/env")).resetEnvForTests();
    await resetDatabase(TEST_DB!);
    dbmod = await import("@/db");
    auth = await import("@/lib/auth");
    admins = await import("@/lib/admin/users");
    overview = await import("@/lib/admin/overview");
    // The owner's account predates ADMIN_EMAIL: its role column is still "user".
    await dbmod
      .db()
      .insert(dbmod.schema.user)
      .values([
        { id: "owner", name: "Owner", email: "owner@debutyard.test", role: "user" },
        { id: "mate", name: "Mate", email: "Mate@x.test" },
        { id: "rando", name: "Rando", email: "rando@x.test" },
      ]);
  });

  afterAll(async () => {
    delete process.env.ADMIN_EMAIL;
    delete process.env.CRON_SECRET;
    await (dbmod?.db() as unknown as { $client: { end(): Promise<void> } } | undefined)?.$client.end();
  });

  it("treats ADMIN_EMAIL as the owner whatever the account's role, and nobody else", async () => {
    expect(await auth.staffRole({ email: "owner@debutyard.test" })).toBe("owner");
    expect(await auth.isStaff({ email: "rando@x.test" })).toBe(false);
    expect(await auth.isStaff(null)).toBe(false);
    const row = await dbmod.db().query.adminUsers.findFirst({
      where: eq(dbmod.schema.adminUsers.email, "owner@debutyard.test"),
    });
    expect(row?.role).toBe("owner");
  });

  it("grants and revokes access by email, protecting the owner and yourself", async () => {
    await expect(admins.addAdmin({ email: "not-an-email", role: "admin" }, "owner")).rejects.toThrow("valid email");
    await expect(admins.addAdmin({ email: "x@x.test", role: "owner" }, "owner")).rejects.toThrow();
    const id = await admins.addAdmin({ email: " MATE@x.test", role: "ops" }, "owner");
    await expect(admins.addAdmin({ email: "mate@x.test", role: "admin" }, "owner")).rejects.toThrow("already");
    // Matching is case-insensitive against the account's email.
    expect(await auth.staffRole({ email: "Mate@x.test" })).toBe("ops");

    const list = await admins.listAdmins();
    expect(list.map((a) => [a.email, a.role, a.hasAccount])).toEqual([
      ["owner@debutyard.test", "owner", true],
      ["mate@x.test", "ops", true],
    ]);
    const ownerId = list[0].id;
    await expect(admins.removeAdmin(ownerId, { email: "mate@x.test" })).rejects.toThrow("owner");
    await expect(admins.removeAdmin(id, { email: "mate@x.test" })).rejects.toThrow("your own");
    await admins.removeAdmin(id, { email: "owner@debutyard.test" });
    expect(await auth.isStaff({ email: "mate@x.test" })).toBe(false);
  });

  it("lets owners and admins, not ops, override the free-debut rules", async () => {
    const adminId = await admins.addAdmin({ email: "boss@x.test", role: "admin" }, "owner");
    const opsId = await admins.addAdmin({ email: "helper@x.test", role: "ops" }, "owner");
    expect(await auth.canOverrideFreeRules({ email: "owner@debutyard.test" })).toBe(true);
    expect(await auth.canOverrideFreeRules({ email: "boss@x.test" })).toBe(true);
    expect(await auth.canOverrideFreeRules({ email: "helper@x.test" })).toBe(false);
    expect(await auth.canOverrideFreeRules({ email: "rando@x.test" })).toBe(false);
    expect(await auth.canOverrideFreeRules(null)).toBe(false);
    await admins.removeAdmin(adminId, { email: "owner@debutyard.test" });
    await admins.removeAdmin(opsId, { email: "owner@debutyard.test" });
  });

  it("builds the overview on a fresh database", async () => {
    const o = await overview.adminOverview(new Date());
    expect(o.users.total).toBe(3);
    expect(o.revenue.last30Cents).toBe(0);
    expect(o.recentOrders).toEqual([]);
    expect(await overview.cronStatus(new Date())).toEqual([
      { job: "daily", lastStartedAt: null, lastFinishedAt: null, failed: [], stale: true },
    ]);
  });

  it("logs cron runs with their failed tasks", async () => {
    const { runCron } = await import("@/lib/cron");
    const req = (auth?: string) =>
      new Request("https://x.test/api/cron/daily", { headers: auth ? { authorization: auth } : {} });
    expect((await runCron(req(), "daily", [])).status).toBe(401);
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await runCron(req("Bearer cron-secret"), "daily", [
      ["ok", async () => 1],
      [
        "boom",
        async () => {
          throw new Error("nope");
        },
      ],
    ]);
    expect(await res.json()).toEqual({ ok: 1, boom: { error: "nope" } });
    const [status] = await overview.cronStatus(new Date());
    expect(status).toMatchObject({ job: "daily", failed: ["boom"], stale: false });
    expect(status.lastFinishedAt).not.toBeNull();
  });
});
