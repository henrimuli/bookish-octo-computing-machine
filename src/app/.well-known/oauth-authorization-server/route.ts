import { site } from "@/config/site";
import { CORS, preflight } from "@/lib/api/http";

export const OPTIONS = preflight;

/** RFC 8414 metadata: public clients, dynamic registration, authorization code + PKCE (S256). */
export function GET() {
  const base = site.url.replace(/\/$/, "");
  return Response.json(
    {
      issuer: base,
      authorization_endpoint: `${base}/connect`,
      token_endpoint: `${base}/api/oauth/token`,
      registration_endpoint: `${base}/api/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: ["mcp"],
      service_documentation: `${base}/docs`,
    },
    { headers: CORS },
  );
}
