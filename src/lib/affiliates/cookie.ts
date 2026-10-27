import "server-only";
import { cookies } from "next/headers";
import { isAffiliateCode, VIA_COOKIE } from "./rules";

/** The affiliate code from the visitor's referral cookie, if any. For checkout callers. */
export async function referralCode(): Promise<string | null> {
  const value = (await cookies()).get(VIA_COOKIE)?.value;
  return isAffiliateCode(value) ? value : null;
}
