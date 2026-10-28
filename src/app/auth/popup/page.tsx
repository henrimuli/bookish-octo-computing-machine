import type { Metadata } from "next";
import { Suspense } from "react";
import { PopupDone } from "./popup-done";

export const metadata: Metadata = { title: "Signing in", robots: { index: false } };

/** Where Google/GitHub send the sign-in popup back to. It reports to the opener and closes. */
export default function AuthPopupPage() {
  return (
    <main className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
      <Suspense fallback={<p>Signing you in…</p>}>
        <PopupDone />
      </Suspense>
    </main>
  );
}
