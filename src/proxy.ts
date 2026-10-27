import { NextResponse, type NextRequest } from "next/server";
import { isAffiliateCode, VIA_COOKIE, VIA_DAYS } from "@/lib/affiliates/rules";

/**
 * Affiliate links: `?via=<code>` on any page sets a first-party cookie for
 * 60 days (the latest link wins). Checkout reads it. Only runs when `via` is
 * in the query.
 */
export function proxy(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("via")?.toLowerCase();
  const response = NextResponse.next();
  if (isAffiliateCode(code)) {
    response.cookies.set(VIA_COOKIE, code, {
      maxAge: VIA_DAYS * 86_400,
      path: "/",
      sameSite: "lax",
      httpOnly: true,
      secure: request.nextUrl.protocol === "https:",
    });
  }
  return response;
}

export const config = {
  matcher: [{ source: "/((?!api|_next|.*\..*).*)", has: [{ type: "query", key: "via" }] }],
};
