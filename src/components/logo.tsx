import Link from "next/link";
import { cn } from "@/lib/utils";

/** Wordmark: "Debut" in ink, "Yard" in brand colour, with a small spotlight mark. */
export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn("inline-flex items-center gap-2 font-display text-xl font-bold tracking-tight", className)}
    >
      <svg aria-hidden viewBox="0 0 24 24" className="size-6">
        <circle cx="12" cy="12" r="11" className="fill-primary" />
        <path d="M7 15.5 12 6l5 9.5H7Z" className="fill-primary-foreground" />
      </svg>
      <span>
        Debut<span className="text-primary">Yard</span>
      </span>
    </Link>
  );
}
