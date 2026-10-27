/**
 * Pure OAuth 2.1 rules for the MCP connect flow: PKCE (S256 only), which
 * redirect URIs a client may register, and the redirect back to the client.
 */
import { createHash } from "node:crypto";

export const CODE_TTL_MS = 5 * 60_000;
export const MAX_REDIRECT_URIS = 5;

const b64url = (buf: Buffer) => buf.toString("base64url");

/** RFC 7636: the challenge is base64url(sha256(verifier)), verifier 43–128 unreserved chars. */
export function verifyPkce(verifier: string, challenge: string): boolean {
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return false;
  return b64url(createHash("sha256").update(verifier).digest()) === challenge;
}

export const validChallenge = (c: string) => /^[A-Za-z0-9_-]{43}$/.test(c);

/**
 * Allowed redirect URIs: https anywhere, http only on loopback (any port, as
 * native apps pick one at runtime), and private-use schemes like
 * `cursor://…`. No fragments, and no schemes a browser would run.
 */
export function validRedirectUri(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.hash || raw.length > 500) return false;
  const scheme = u.protocol.slice(0, -1);
  if (scheme === "https") return true;
  if (scheme === "http") return ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
  if (["javascript", "data", "file", "vbscript", "blob", "about", "ftp", "ws", "wss"].includes(scheme)) return false;
  return /^[a-z][a-z0-9+.-]*$/.test(scheme);
}

/**
 * Whether a requested redirect matches a registered one. Exact match, except
 * that loopback http URIs match on any port (RFC 8252 §7.3).
 */
export function redirectMatches(registered: string[], requested: string): boolean {
  if (registered.includes(requested)) return true;
  const req = safeUrl(requested);
  if (!req || req.protocol !== "http:") return false;
  return registered.some((r) => {
    const reg = safeUrl(r);
    return (
      reg?.protocol === "http:" &&
      reg.hostname === req.hostname &&
      reg.pathname === req.pathname &&
      reg.search === req.search
    );
  });
}

function safeUrl(raw: string) {
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

/** The redirect back to the client with `code` or `error`, keeping its own query. */
export function buildRedirect(redirectUri: string, params: Record<string, string | undefined>): string {
  const u = new URL(redirectUri);
  for (const [k, v] of Object.entries(params)) if (v !== undefined) u.searchParams.set(k, v);
  return u.toString();
}
