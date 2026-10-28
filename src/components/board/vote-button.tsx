"use client";

import { usePathname, useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { toggleVoteAction } from "@/app/(site)/p/actions";
import { cn } from "@/lib/utils";

export function VoteButton({
  productId,
  voted,
  votes,
  size = "md",
}: {
  productId: string;
  voted: boolean;
  votes: number;
  size?: "md" | "lg";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState({ voted, votes });
  const [optimistic, setOptimistic] = useOptimistic(state);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  function click() {
    setError(null);
    start(async () => {
      setOptimistic({ voted: !state.voted, votes: state.votes + (state.voted ? -1 : 1) });
      const res = await toggleVoteAction(productId);
      if (!res.ok) {
        if (res.needsAuth) router.push(`/sign-in?next=${encodeURIComponent(pathname)}`);
        else setError(res.error);
        return;
      }
      setState(res.data);
    });
  }

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={click}
        aria-pressed={optimistic.voted}
        aria-label={optimistic.voted ? "Remove vote" : "Vote"}
        className={cn(
          "flex flex-col items-center justify-center rounded-md border font-semibold transition-colors",
          size === "lg" ? "h-16 w-16 text-base" : "h-14 w-12 text-sm",
          optimistic.voted
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-card hover:border-primary hover:text-primary",
        )}
      >
        <svg viewBox="0 0 12 8" aria-hidden className="mb-0.5 w-3 fill-current">
          <path d="M6 0 12 8H0z" />
        </svg>
        {optimistic.votes}
      </button>
      {error && <span className="mt-1 max-w-24 text-center text-[10px] text-danger">{error}</span>}
    </div>
  );
}
