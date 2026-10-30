"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { subscribeSignedInAction } from "@/app/(site)/newsletter/actions";
import { safeNext } from "@/components/sign-in-form";
import { AUTH_MESSAGE, type AuthMessage } from "@/lib/auth-popup";

const errorText: Record<string, string> = {
  access_denied: "You cancelled the sign-in.",
  account_not_linked: "That email already has an account with a different sign-in method.",
};

/** Reports to the opener and closes, or (no popup) carries on to `next`. */
function finish(error: string | null, next: string) {
  const opener = window.opener as Window | null;
  // Opened as a popup: tell the page that opened it, then close.
  if (opener && !opener.closed) {
    try {
      const message: AuthMessage = error
        ? { type: AUTH_MESSAGE, ok: false, error: errorText[error] ?? "Sign-in didn't complete. Try again." }
        : { type: AUTH_MESSAGE, ok: true };
      opener.postMessage(message, window.location.origin);
      window.close();
      return;
    } catch {
      // Cross-origin opener: fall through to a normal redirect.
    }
  }
  // Popup was blocked (or this is a magic link), so this was a full-page visit.
  window.location.replace(error ? `/sign-in?next=${encodeURIComponent(next)}&error=${error}` : next);
}

export function PopupDone() {
  const params = useSearchParams();
  const error = params.get("error");
  const next = safeNext(params.get("next"), "/dashboard");
  const digest = params.get("newsletter") === "1";

  useEffect(() => {
    let cancelled = false;
    // The digest switch on the sign-in form: subscribe the address that just signed in, then carry on.
    const subscribed = digest && !error ? subscribeSignedInAction().catch(() => false) : Promise.resolve(false);
    subscribed.then(() => {
      if (!cancelled) finish(error, next);
    });
    return () => {
      cancelled = true;
    };
  }, [error, next, digest]);

  return (
    <p>{error ? "Sign-in didn't complete. You can close this window." : "Signed in. You can close this window."}</p>
  );
}
