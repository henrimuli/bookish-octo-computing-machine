import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

async function load(env: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v as string);
  const mod = await import("./turnstile");
  (await import("@/env")).resetEnvForTests();
  return mod;
}

describe("verifyTurnstile", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("asks Cloudflare and trusts only success", async () => {
    const { verifyTurnstile } = await load({ TURNSTILE_SECRET_KEY: "secret", NODE_ENV: "production" });
    const fetch = vi.fn(async (_url: string, init: { body: URLSearchParams }) => {
      const ok = init.body.get("response") === "good" && init.body.get("secret") === "secret";
      return new Response(JSON.stringify({ success: ok, "error-codes": ok ? [] : ["invalid-input-response"] }));
    });
    vi.stubGlobal("fetch", fetch);
    expect(await verifyTurnstile("good", "1.2.3.4")).toBe(true);
    expect(fetch.mock.calls[0][1].body.get("remoteip")).toBe("1.2.3.4");
    expect(await verifyTurnstile("bad", null)).toBe(false);
    expect(await verifyTurnstile(null, null)).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("fails closed when Cloudflare can't be reached", async () => {
    const { verifyTurnstile } = await load({ TURNSTILE_SECRET_KEY: "secret" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new Error("offline"))),
    );
    expect(await verifyTurnstile("good", null)).toBe(false);
  });

  it("refuses in production without a secret, and skips the check in development", async () => {
    const prod = await load({ TURNSTILE_SECRET_KEY: "", NODE_ENV: "production" });
    expect(await prod.verifyTurnstile("anything", null)).toBe(false);
    expect(prod.turnstileSiteKey()).toBeNull();
    const dev = await load({ TURNSTILE_SECRET_KEY: "", NODE_ENV: "development" });
    expect(await dev.verifyTurnstile(null, null)).toBe(true);
  });
});
