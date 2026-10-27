import { preflight } from "@/lib/api/http";
import { mcpNotAllowed, mcpPost } from "@/lib/api/mcp-http";

export const OPTIONS = preflight;

/** The OAuth-connect endpoint: same server as /api/mcp, but a token is required. */
export function POST(request: Request) {
  return mcpPost(request, { path: "/mcp", requireAuth: true });
}

export const GET = mcpNotAllowed;
export const DELETE = mcpNotAllowed;
