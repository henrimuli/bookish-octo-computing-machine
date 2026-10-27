import { CORS, preflight } from "@/lib/api/http";
import { exchangeCode, OAuthError } from "@/lib/api/oauth";

export const OPTIONS = preflight;

const HEADERS = { ...CORS, "Cache-Control": "no-store" };

/** Token endpoint: form-encoded per RFC 6749 (JSON accepted too). */
export async function POST(request: Request) {
  const type = request.headers.get("content-type") ?? "";
  const params: Record<string, string> = type.includes("application/json")
    ? Object.fromEntries(
        Object.entries(((await request.json().catch(() => null)) ?? {}) as Record<string, unknown>).map(([k, v]) => [
          k,
          String(v),
        ]),
      )
    : Object.fromEntries(new URLSearchParams(await request.text()));
  try {
    const token = await exchangeCode({
      grantType: params.grant_type ?? "",
      code: params.code ?? "",
      clientId: params.client_id ?? "",
      redirectUri: params.redirect_uri ?? "",
      codeVerifier: params.code_verifier ?? "",
    });
    return Response.json(token, { headers: HEADERS });
  } catch (err) {
    if (err instanceof OAuthError) {
      return Response.json(
        { error: err.error, error_description: err.message },
        { status: err.status, headers: HEADERS },
      );
    }
    throw err;
  }
}
