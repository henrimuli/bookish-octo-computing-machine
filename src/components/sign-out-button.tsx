"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Icon } from "@/components/app-shell/icons";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth-client";

/** `compact`: an icon button for app sidebars. Signing out from the app returns to the homepage. */
export function SignOutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const run = () =>
    startTransition(async () => {
      await signOut();
      if (compact) router.replace("/");
      router.refresh();
    });

  if (compact) {
    return (
      <button
        type="button"
        onClick={run}
        disabled={pending}
        title="Sign out"
        aria-label="Sign out"
        className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
      >
        <Icon name="logout" />
      </button>
    );
  }
  return (
    <Button variant="outline" size="sm" disabled={pending} onClick={run}>
      Sign out
    </Button>
  );
}
