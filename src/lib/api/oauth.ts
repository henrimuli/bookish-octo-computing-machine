import "server-only";
import { and, eq, isNull, lt, or } from "drizzle-orm";
import { createHash, randomBytes } from "node:crypto";
import { db, schema } from "@/db";
import { CODE_TTL_MS, MAX_REDIRECT_URIS, redirectMatches, validRedirectUri, verifyPkce } from "./oauth-rules";
import { createToken } from "./tokens";

const { oauthClients, oauthCodes, apiTokens } = schema;
const hash = (v: string) => createHash("sha256").update(v).digest("hex");

/** `error` is an RFC 6749 error code, sent back to the client as-is. */
export class OAuthError extends Error {
  constructor(
    readonly error: string,
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}

/** Dynamic client registration (RFC 7591). Public clients only: auth is PKCE, so there's no secret. */
export async function registerClient(input: unknown) {
  const body = (input ?? {}) as { client_name?: unknown; redirect_uris?: unknown };
  const uris = Array.isArray(body.redirect_uris) ? body.redirect_uris.filter((u) => typeof u === "string") : [];
  if (uris.length === 0 || uris.length > MAX_REDIRECT_URIS || !uris.every(validRedirectUri)) {
    throw new OAuthError("invalid_redirect_uri", "redirect_uris must be 1–5 https, loopback or app-scheme URLs.");
  }
  const name = (typeof body.client_name === "string" ? body.client_name.trim().slice(0, 60) : "") || "MCP client";
  const id = `dyc_${randomBytes(16).toString("base64url")}`;
  const [row] = await db().insert(oauthClients).values({ id, name, redirectUris: uris }).returning();
  return {
    client_id: row.id,
    client_id_issued_at: Math.floor(row.createdAt.getTime() / 1000),
    client_name: row.name,
    redirect_uris: row.redirectUris,
    grant_types: ["authorization_code"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  };
}

export async function getClient(id: string) {
  return (await db().query.oauthClients.findFirst({ where: eq(oauthClients.id, id) })) ?? null;
}

export type AuthorizeRequest = {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  responseType: string;
};

/**
 * Checks an authorize request. Errors that mean we can't trust the redirect
 * (unknown client, unregistered URI) are shown on our page; the rest go back
 * to the client.
 */
export async function checkAuthorize(req: AuthorizeRequest) {
  const client = req.clientId ? await getClient(req.clientId) : null;
  if (!client)
    return { fatal: "This app isn't registered with DebutYard. Try connecting again from the app." } as const;
  if (!redirectMatches(client.redirectUris, req.redirectUri)) {
    return { fatal: "The app sent a redirect address it didn't register, so we stopped here." } as const;
  }
  if (req.responseType !== "code") return { client, error: "unsupported_response_type" } as const;
  if (req.codeChallengeMethod !== "S256" || !/^[A-Za-z0-9_-]{43}$/.test(req.codeChallenge)) {
    return { client, error: "invalid_request" } as const;
  }
  return { client } as const;
}

/** Issues a one-time code after the signed-in user approves. */
export async function createAuthCode(userId: string, req: AuthorizeRequest, now = new Date()) {
  const checked = await checkAuthorize(req);
  if ("fatal" in checked || checked.error) throw new OAuthError("invalid_request", "Invalid authorization request.");
  const code = randomBytes(32).toString("base64url");
  await db()
    .delete(oauthCodes)
    .where(
      or(lt(oauthCodes.expiresAt, now), and(eq(oauthCodes.userId, userId), eq(oauthCodes.clientId, req.clientId))),
    );
  await db()
    .insert(oauthCodes)
    .values({
      codeHash: hash(code),
      clientId: req.clientId,
      userId,
      redirectUri: req.redirectUri,
      codeChallenge: req.codeChallenge,
      expiresAt: new Date(now.getTime() + CODE_TTL_MS),
    });
  return code;
}

/**
 * Trades a code for an API token named after the client. Reconnecting the
 * same client revokes its previous token, so tokens don't pile up.
 */
export async function exchangeCode(
  input: { grantType: string; code: string; clientId: string; redirectUri: string; codeVerifier: string },
  now = new Date(),
) {
  if (input.grantType !== "authorization_code") {
    throw new OAuthError("unsupported_grant_type", "Only authorization_code is supported.");
  }
  // Claim the code atomically: a replayed code finds nothing to update.
  const [row] = await db()
    .update(oauthCodes)
    .set({ usedAt: now })
    .where(and(eq(oauthCodes.codeHash, hash(input.code)), isNull(oauthCodes.usedAt)))
    .returning();
  const bad = () => new OAuthError("invalid_grant", "The code is invalid, expired or already used.");
  if (!row || row.expiresAt <= now || row.clientId !== input.clientId || row.redirectUri !== input.redirectUri) {
    throw bad();
  }
  if (!verifyPkce(input.codeVerifier, row.codeChallenge)) throw bad();

  const client = (await getClient(row.clientId))!;
  await db()
    .update(apiTokens)
    .set({ revokedAt: now })
    .where(and(eq(apiTokens.userId, row.userId), eq(apiTokens.clientId, row.clientId), isNull(apiTokens.revokedAt)));
  const { token } = await createToken(row.userId, client.name, client.id).catch((err: Error) => {
    throw new OAuthError("access_denied", err.message);
  });
  return { access_token: token, token_type: "Bearer", scope: "mcp" };
}
