import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { SignInPanel } from "./sign-in-panel";
import { enabledSocialProviders } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in" };

/** Dedicated sign-in page: no header or footer, just the form. */
export default function SignInPage() {
  return (
    <main className="relative flex flex-1 flex-col items-center justify-center px-4 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,color-mix(in_srgb,var(--primary)_14%,transparent),transparent_60%)]"
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo className="text-2xl" />
        </div>
        <div className="rounded-xl border border-border bg-card p-7 shadow-xl shadow-black/5">
          <h1 className="font-display text-2xl font-bold tracking-tight">Sign in to DebutYard</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">New here? Signing in creates your account.</p>
          <Suspense>
            <SignInPanel socialProviders={enabledSocialProviders()} />
          </Suspense>
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          By continuing you agree to our{" "}
          <Link href="/terms" className="underline underline-offset-4 hover:text-foreground">
            terms
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
            privacy policy
          </Link>
          .
        </p>
        <p className="mt-3 text-center text-sm">
          <Link href="/" className="text-muted-foreground hover:text-foreground">
            ← Back to DebutYard
          </Link>
        </p>
      </div>
    </main>
  );
}
