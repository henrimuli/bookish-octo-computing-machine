"use client";

import { usePathname, useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { toggleApplauseAction } from "@/app/(site)/p/actions";
import { cn } from "@/lib/utils";
import { ClapIcon } from "./clap-icon";

const SPARKS = [0, 60, 120, 180, 240, 300];

/**
 * The clap button: one clap per signed-in account, a second click takes it
 * back. Clapping pops the hands, bursts a few sparks and rolls the count up;
 * taking it back rolls the count down. Signed-out viewers go to sign-in.
 */
export function ClapButton({
  productId,
  applauded,
  applause,
  signedIn,
  size = "md",
}: {
  productId: string;
  applauded: boolean;
  applause: number;
  /** Known on boards and product pages; when false, a click goes straight to sign-in. */
  signedIn?: boolean;
  size?: "md" | "lg";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState({ applauded, applause });
  const [optimistic, setOptimistic] = useOptimistic(state);
  const [error, setError] = useState<string | null>(null);
  // Bumped on each clap so the pop and burst replay; the sign says which way the count rolls.
  const [claps, setClaps] = useState(0);
  const [, start] = useTransition();

  function signIn() {
    router.push(`/sign-in?next=${encodeURIComponent(pathname)}`);
  }

  function click() {
    if (signedIn === false) return signIn();
    setError(null);
    const giving = !state.applauded;
    setClaps((n) => (giving ? Math.abs(n) + 1 : -(Math.abs(n) + 1)));
    start(async () => {
      setOptimistic({ applauded: giving, applause: state.applause + (giving ? 1 : -1) });
      const res = await toggleApplauseAction(productId);
      if (!res.ok) {
        if (res.needsAuth) signIn();
        else setError(res.error);
        return;
      }
      setState(res.data);
    });
  }

  const on = optimistic.applauded;
  const lg = size === "lg";
  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      <button
        type="button"
        onClick={click}
        aria-pressed={on}
        aria-label={`${on ? "Take back your applause" : "Applaud"} (${optimistic.applause} applause)`}
        className={cn(
          "relative grid place-items-center rounded-full border transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
          lg ? "size-14" : "size-11",
          on
            ? "border-primary/40 bg-primary/10 text-primary"
            : "border-border bg-card text-muted-foreground hover:border-primary hover:text-primary",
        )}
      >
        <span key={claps} className={cn("grid place-items-center", claps > 0 && "clap-pop")}>
          <ClapIcon on={on} className={lg ? "size-7" : "size-6"} />
        </span>
        {claps > 0 && (
          <span key={`burst-${claps}`} aria-hidden className="clap-burst">
            {SPARKS.map((deg) => (
              <span key={deg} style={{ "--a": `${deg}deg` } as React.CSSProperties} />
            ))}
          </span>
        )}
      </button>
      <span
        className={cn(
          "relative overflow-hidden font-semibold tabular-nums leading-none",
          lg ? "h-4 text-sm" : "h-3.5 text-xs",
          on ? "text-primary" : "text-muted-foreground",
        )}
        aria-hidden
      >
        <span
          key={optimistic.applause}
          className={cn("block", claps > 0 && "clap-count-up", claps < 0 && "clap-count-down")}
        >
          {optimistic.applause}
        </span>
      </span>
      {error && <span className="max-w-24 text-center text-[10px] text-danger">{error}</span>}
    </div>
  );
}
