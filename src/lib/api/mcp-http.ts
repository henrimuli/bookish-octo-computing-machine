import "server-only";
import { site } from "@/config/site";
import { clientIp } from "@/lib/request";
import { CORS } from "./http";
import { handleMessage } from "./mcp";
import { authenticate } from "./tokens";

const base = () => site.url.replace(/\/$/, "");

/** Where OAuth clients find how to get a token for `path` (RFC 9728). */
export const resourceMetadataUrl = (path: string) => `${base()}/.well-known/oauth-protected-resource${path}`;

function unauthorized(message: string, path: string) {
  return Response.json(
    { jsonrpc: "2.0", id: null, error: { code: -32001, message } },
    {
      status: 401,
      headers: {
        ...CORS,
        "WWW-Authenticate": `Bearer resource_metadata="${resourceMetadataUrl(path)}"`,
        "Access-Control-Expose-Headers": "WWW-Authenticate",
      },
    },
  );
}

/**
 * MCP over Streamable HTTP, stateless: every POST carries one JSON-RPC
 * message (or a batch). `/api/mcp` also serves anonymous callers; `/mcp`
 * requires a token, which is how OAuth clients learn to start the connect flow.
 */
export async function mcpPost(request: Request, opts: { path: string; requireAuth: boolean }) {
  const user = await authenticate(request);
  if (!user && request.headers.get("authorization")) return unauthorized("Invalid or revoked API token.", opts.path);
  if (!user && opts.requireAuth) return unauthorized("Connect your DebutYard account to use this server.", opts.path);
  const body = await request.json().catch(() => undefined);
  if (body === undefined) {
    return Response.json(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
      { status: 400, headers: CORS },
    );
  }
  const ctx = { user, clientKey: clientIp(request.headers) ?? "unknown" };
  const responses = Array.isArray(body)
    ? (await Promise.all(body.map((m) => handleMessage(m, ctx)))).filter((r) => r !== null)
    : [await handleMessage(body, ctx)].filter((r) => r !== null);
  if (responses.length === 0) return new Response(null, { status: 202, headers: CORS });
  return Response.json(Array.isArray(body) ? responses : responses[0], { headers: CORS });
}

/** No server-initiated stream: this server never sends requests or notifications. */
export function mcpNotAllowed() {
  return new Response("Method Not Allowed", { status: 405, headers: { ...CORS, Allow: "POST, OPTIONS" } });
}
