"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth-client";

/** Signs out, then opens sign-in so they can come back to this page with another account. */
export function SwitchAccountButton() {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await signOut();
          router.push(`/sign-in?next=${encodeURIComponent(pathname)}`);
        })
      }
    >
      {pending ? "Signing out…" : "Sign in with a different account"}
    </Button>
  );
}
