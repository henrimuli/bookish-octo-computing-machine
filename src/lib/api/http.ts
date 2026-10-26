import "server-only";
import { clientIp } from "@/lib/request";
import { ApiError } from "./operations";
import { authenticate, type ApiUser } from "./tokens";

/** Token auth, no cookies, so any origin may call the API. */
export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Mcp-Session-Id, Mcp-Protocol-Version",
};

export function preflight() {
  return new Response(null, { status: 204, headers: CORS });
}

export type ApiContext = { user: ApiUser | null; clientKey: string };

/** Runs an API handler: auth, JSON body, errors as `{ error }`. */
export async function api(
  request: Request,
  fn: (ctx: ApiContext & { body: unknown }) => Promise<unknown>,
): Promise<Response> {
  try {
    const user = await authenticate(request);
    if (!user && request.headers.get("authorization")) throw new ApiError("Invalid or revoked API token.", 401);
    const body = request.method === "POST" ? await request.json().catch(() => null) : null;
    const data = await fn({ user, clientKey: clientIp(request.headers) ?? "unknown", body });
    return Response.json({ data }, { headers: CORS });
  } catch (err) {
    if (err instanceof ApiError) return Response.json({ error: err.message }, { status: err.status, headers: CORS });
    if (err instanceof Error && err.name === "ZodError") {
      return Response.json({ error: "Invalid input." }, { status: 400, headers: CORS });
    }
    console.error("api error", err);
    return Response.json({ error: "Something went wrong." }, { status: 500, headers: CORS });
  }
}
