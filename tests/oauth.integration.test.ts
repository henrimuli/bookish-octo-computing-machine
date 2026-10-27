/**
 * The MCP OAuth connect flow against a real Postgres: dynamic registration,
 * approval, the code-for-token exchange (PKCE, one use) and /mcp requiring
 * the token. Runs when TEST_DATABASE_URL is set; the database is wiped.
 */
import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resetDatabase } from "./helpers/db";

const TEST_DB = process.env.TEST_DATABASE_URL;

describe.skipIf(!TEST_DB)("MCP OAuth connect (Postgres)", () => {
  let dbmod: typeof import("@/db");
  let oauth: typeof import("@/lib/api/oauth");
  const redirectUri = "http://127.0.0.1/callback";

  beforeAll(async () => {
    process.env.DATABASE_URL = TEST_DB;
    process.env.NEXT_PUBLIC_SITE_URL = "https://debutyard.test";
    (await import("@/env")).resetEnvForTests();
    await resetDatabase(TEST_DB!);
    dbmod = await import("@/db");
    oauth = await import("@/lib/api/oauth");
    await dbmod.db().insert(dbmod.schema.user).values({ id: "u1", name: "Ada", email: "ada@x.test" });
  });

  afterAll(async () => {
    await (dbmod?.db() as unknown as { $client: { end(): Promise<void> } } | undefined)?.$client.end();
  });

  const pkce = () => {
    const verifier = randomBytes(32).toString("base64url");
    return { verifier, challenge: createHash("sha256").update(verifier).digest("base64url") };
  };

  const register = async () => {
    const route = await import("@/app/api/oauth/register/route");
    const res = await route.POST(
      new Request("https://debutyard.test/api/oauth/register", {
        method: "POST",
        body: JSON.stringify({ client_name: "Claude", redirect_uris: [redirectUri] }),
      }),
    );
    expect(res.status).toBe(201);
    return (await res.json()) as { client_id: string };
  };

  const token = async (params: Record<string, string>) => {
    const route = await import("@/app/api/oauth/token/route");
    return route.POST(
      new Request("https://debutyard.test/api/oauth/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(params).toString(),
      }),
    );
  };

  const mcp = async (auth?: string) => {
    const route = await import("@/app/mcp/route");
    return route.POST(
      new Request("https://debutyard.test/mcp", {
        method: "POST",
        headers: { "content-type": "application/json", ...(auth ? { authorization: auth } : {}) },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      }),
    );
  };

  it("refuses bad registrations and unregistered redirects", async () => {
    const route = await import("@/app/api/oauth/register/route");
    const res = await route.POST(
      new Request("https://debutyard.test/api/oauth/register", {
        method: "POST",
        body: JSON.stringify({ redirect_uris: ["http://evil.test/cb"] }),
      }),
    );
    expect(res.status).toBe(400);
    const { client_id } = await register();
    const req = {
      clientId: client_id,
      redirectUri: "https://evil.test/cb",
      responseType: "code",
      codeChallenge: pkce().challenge,
      codeChallengeMethod: "S256",
    };
    expect(await oauth.checkAuthorize(req)).toHaveProperty("fatal");
    expect(await oauth.checkAuthorize({ ...req, redirectUri: "http://127.0.0.1:4711/callback" })).not.toHaveProperty(
      "fatal",
    );
    expect(await oauth.checkAuthorize({ ...req, redirectUri, codeChallengeMethod: "plain" })).toMatchObject({
      error: "invalid_request",
    });
  });

  it("asks for a token on /mcp, then trades an approved code for one", async () => {
    const anon = await mcp();
    expect(anon.status).toBe(401);
    expect(anon.headers.get("www-authenticate")).toBe(
      'Bearer resource_metadata="https://debutyard.test/.well-known/oauth-protected-resource/mcp"',
    );

    const { client_id } = await register();
    const { verifier, challenge } = pkce();
    const req = {
      clientId: client_id,
      redirectUri,
      responseType: "code",
      codeChallenge: challenge,
      codeChallengeMethod: "S256",
    };
    const code = await oauth.createAuthCode("u1", req);
    const base = { grant_type: "authorization_code", code, client_id, redirect_uri: redirectUri };

    expect((await token({ ...base, code_verifier: pkce().verifier })).status).toBe(400);
    // A failed verifier still burns the code.
    expect(await (await token({ ...base, code_verifier: verifier })).json()).toMatchObject({ error: "invalid_grant" });

    const code2 = await oauth.createAuthCode("u1", req);
    const ok = await token({ ...base, code: code2, code_verifier: verifier });
    const body = (await ok.json()) as { access_token: string; token_type: string };
    expect(body.token_type).toBe("Bearer");
    expect(body.access_token).toMatch(/^dy_/);
    expect((await token({ ...base, code: code2, code_verifier: verifier })).status).toBe(400);

    const listed = await mcp(`Bearer ${body.access_token}`);
    expect(listed.status).toBe(200);
    expect(((await listed.json()) as { result: { tools: unknown[] } }).result.tools.length).toBeGreaterThan(0);

    // Reconnecting the same app replaces its token.
    const code3 = await oauth.createAuthCode("u1", req);
    await token({ ...base, code: code3, code_verifier: verifier });
    const { apiTokens } = dbmod.schema;
    const live = await dbmod
      .db()
      .select()
      .from(apiTokens)
      .where(and(eq(apiTokens.clientId, client_id), isNull(apiTokens.revokedAt)));
    expect(live).toHaveLength(1);
    expect(live[0].name).toBe("Claude");
    expect((await mcp(`Bearer ${body.access_token}`)).status).toBe(401);
  });
});
