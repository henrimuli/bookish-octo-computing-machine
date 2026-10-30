import "server-only";
import { env } from "@/env";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Whether the bot check is set up, i.e. the page should render the invisible widget. */
export const turnstileSiteKey = () =>
  env().TURNSTILE_SECRET_KEY ? (env().NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? null) : null;

/**
 * Checks a Cloudflare Turnstile token with Cloudflare. Tokens are single-use
 * and expire after 5 minutes. Without a secret configured the check is skipped
 * in development but fails in production, so a missing key never leaves the
 * checker open.
 */
export async function verifyTurnstile(token: string | null | undefined, ip: string | null): Promise<boolean> {
  const secret = env().TURNSTILE_SECRET_KEY;
  if (!secret) {
    if (env().NODE_ENV === "production") {
      console.error("TURNSTILE_SECRET_KEY is not set: refusing bot-checked requests");
      return false;
    }
    return true;
  }
  if (!token || token.length > 2048) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (ip) body.set("remoteip", ip);
  try {
    const res = await fetch(VERIFY_URL, { method: "POST", body, signal: AbortSignal.timeout(8000) });
    const data = (await res.json()) as { success?: boolean; "error-codes"?: string[] };
    if (!data.success) console.warn("Turnstile rejected a token", data["error-codes"]);
    return data.success === true;
  } catch (err) {
    console.error("Turnstile verification failed", err);
    return false;
  }
}
