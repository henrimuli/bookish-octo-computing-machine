import { CORS, preflight } from "@/lib/api/http";
import { OAuthError, registerClient } from "@/lib/api/oauth";

export const OPTIONS = preflight;

/** Dynamic client registration (RFC 7591), so MCP clients can connect without setup. */
export async function POST(request: Request) {
  try {
    const client = await registerClient(await request.json().catch(() => null));
    return Response.json(client, { status: 201, headers: { ...CORS, "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof OAuthError) {
      return Response.json({ error: err.error, error_description: err.message }, { status: err.status, headers: CORS });
    }
    throw err;
  }
}
