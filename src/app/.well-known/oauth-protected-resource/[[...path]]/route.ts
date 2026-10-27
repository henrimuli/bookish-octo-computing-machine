import { site } from "@/config/site";
import { CORS, preflight } from "@/lib/api/http";

export const OPTIONS = preflight;

/** RFC 9728 protected-resource metadata for /mcp (and /api/mcp): our own server issues the tokens. */
export async function GET(_request: Request, ctx: RouteContext<"/.well-known/oauth-protected-resource/[[...path]]">) {
  const base = site.url.replace(/\/$/, "");
  const { path } = await ctx.params;
  const resource = path?.length ? `/${path.join("/")}` : "/mcp";
  if (resource !== "/mcp" && resource !== "/api/mcp") return new Response("Not found", { status: 404, headers: CORS });
  return Response.json(
    {
      resource: `${base}${resource}`,
      authorization_servers: [base],
      bearer_methods_supported: ["header"],
      scopes_supported: ["mcp"],
      resource_name: "DebutYard",
      resource_documentation: `${base}/docs`,
    },
    { headers: CORS },
  );
}
