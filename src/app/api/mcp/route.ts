import { CORS, preflight } from "@/lib/api/http";
import { handleMessage } from "@/lib/api/mcp";
import { authenticate } from "@/lib/api/tokens";
import { clientIp } from "@/lib/request";

export const OPTIONS = preflight;

/** MCP over Streamable HTTP, stateless: every POST carries one JSON-RPC message (or a batch). */
export async function POST(request: Request) {
  const user = await authenticate(request);
  if (!user && request.headers.get("authorization")) {
    return Response.json(
      { jsonrpc: "2.0", id: null, error: { code: -32001, message: "Invalid or revoked API token." } },
      { status: 401, headers: CORS },
    );
  }
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
export function GET() {
  return new Response("Method Not Allowed", { status: 405, headers: { ...CORS, Allow: "POST, OPTIONS" } });
}

export const DELETE = GET;
