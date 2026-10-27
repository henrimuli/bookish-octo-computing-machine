import { preflight } from "@/lib/api/http";
import { mcpNotAllowed, mcpPost } from "@/lib/api/mcp-http";

export const OPTIONS = preflight;

/** Token optional: anonymous callers get the public tools. */
export function POST(request: Request) {
  return mcpPost(request, { path: "/api/mcp", requireAuth: false });
}

export const GET = mcpNotAllowed;
export const DELETE = mcpNotAllowed;
