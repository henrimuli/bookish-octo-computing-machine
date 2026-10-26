"use client";

import { useActionState } from "react";
import { subscribeAction } from "@/app/newsletter/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export function NewsletterForm({ source, className }: { source: string; className?: string }) {
  const [state, action, pending] = useActionState(subscribeAction, null);
  if (state?.ok) return <p className={cn("text-sm text-success", className)}>{state.message}</p>;
  return (
    <form action={action} className={cn("space-y-2", className)}>
      <div className="flex gap-2">
        <Input
          type="email"
          name="email"
          required
          placeholder="you@example.com"
          aria-label="Email"
          className="min-w-0"
        />
        <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
        <input type="hidden" name="source" value={source} />
        <Button type="submit" disabled={pending}>
          {pending ? "…" : "Subscribe"}
        </Button>
      </div>
      {state && !state.ok && <p className="text-sm text-danger">{state.message}</p>}
    </form>
  );
}
