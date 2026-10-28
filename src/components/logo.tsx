import Link from "next/link";
import { LOGO } from "@/config/logo";
import { cn } from "@/lib/utils";

/** The mark on its own: a notched stage triangle on a brand disc. */
export function LogoMark({ className }: { className?: string }) {
  const { cx, cy, r } = LOGO.disc;
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={cn("size-6 shrink-0", className)}>
      <circle cx={cx} cy={cy} r={r} className="fill-primary" />
      <path
        d={LOGO.mark}
        strokeWidth={LOGO.strokeWidth}
        strokeLinejoin="round"
        className="fill-primary-foreground stroke-primary-foreground"
      />
    </svg>
  );
}

/** Wordmark: "Debut" in ink, "Yard" in brand colour, with the mark. */
export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn("inline-flex items-center gap-2 font-display text-xl font-bold tracking-tight", className)}
    >
      <LogoMark />
      <span>
        Debut<span className="text-primary">Yard</span>
      </span>
    </Link>
  );
}
