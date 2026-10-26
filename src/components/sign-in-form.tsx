"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/primitives";
import { signIn } from "@/lib/auth-client";

const providerLabels = { google: "Continue with Google", github: "Continue with GitHub" } as const;

/** Only same-site paths, so ?next= can't be used as an open redirect. */
function safeNext(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}

export function SignInForm({ socialProviders }: { socialProviders: Array<keyof typeof providerLabels> }) {
  const callbackURL = safeNext(useSearchParams().get("next"));
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError(null);
    const { error } = await signIn.magicLink({ email, callbackURL });
    if (error) {
      setError(error.message ?? "Couldn't send the link. Try again.");
      setState("idle");
    } else {
      setState("sent");
    }
  }

  if (state === "sent") {
    return (
      <p className="mt-6 rounded-md bg-success/10 p-4 text-sm text-success">
        Check {email} for your sign-in link. It expires in 15 minutes.
      </p>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      <form onSubmit={sendLink} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={state === "sending"}>
          {state === "sending" ? "Sending…" : "Email me a link"}
        </Button>
        {error && <p className="text-sm text-danger">{error}</p>}
      </form>

      {socialProviders.length > 0 && (
        <div className="space-y-2">
          <p className="text-center text-xs uppercase tracking-wide text-muted-foreground">or</p>
          {socialProviders.map((provider) => (
            <Button
              key={provider}
              variant="outline"
              className="w-full"
              onClick={() => signIn.social({ provider, callbackURL })}
            >
              {providerLabels[provider]}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
