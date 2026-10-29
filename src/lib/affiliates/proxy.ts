// AFFILIATES PAUSED. The affiliate program is switched off for now, not
// deleted: everything below is commented out so it can be restored as is.
// To turn it back on, uncomment the files listed in src/lib/affiliates/PAUSED.md
// and the call sites marked "Affiliates are paused".
// Was src/proxy.ts (Next runs a proxy only from that path). Move it back to restore.

// import { NextResponse, type NextRequest } from "next/server";
// import { isAffiliateCode, VIA_COOKIE, VIA_DAYS } from "@/lib/affiliates/rules";
//
// /**
//  * Affiliate links: `?via=<code>` on any page sets a first-party cookie for
//  * 60 days (the latest link wins). Checkout reads it. Only runs when `via` is
//  * in the query.
//  */
// export function proxy(request: NextRequest) {
//   const code = request.nextUrl.searchParams.get("via")?.toLowerCase();
//   const response = NextResponse.next();
//   if (isAffiliateCode(code)) {
//     response.cookies.set(VIA_COOKIE, code, {
//       maxAge: VIA_DAYS * 86_400,
//       path: "/",
//       sameSite: "lax",
//       httpOnly: true,
//       secure: request.nextUrl.protocol === "https:",
//     });
//   }
//   return response;
// }
//
// export const config = {
//   matcher: [{ source: "/((?!api|_next|.*\..*).*)", has: [{ type: "query", key: "via" }] }],
// };

export {};
