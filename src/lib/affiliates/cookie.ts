// AFFILIATES PAUSED. The affiliate program is switched off for now, not
// deleted: everything below is commented out so it can be restored as is.
// To turn it back on, uncomment the files listed in src/lib/affiliates/PAUSED.md
// and the call sites marked "Affiliates are paused".

// import "server-only";
// import { cookies } from "next/headers";
// import { isAffiliateCode, VIA_COOKIE } from "./rules";
//
// /** The affiliate code from the visitor's referral cookie, if any. For checkout callers. */
// export async function referralCode(): Promise<string | null> {
//   const value = (await cookies()).get(VIA_COOKIE)?.value;
//   return isAffiliateCode(value) ? value : null;
// }

export {};
