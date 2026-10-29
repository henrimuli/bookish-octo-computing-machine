"use client";

import type { VariantProps } from "class-variance-authority";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Scrolls back up to the package cards (#packages); a plain anchor without JavaScript. */
export function ToPackages({
  children = "See packages",
  variant = "primary",
  size = "lg",
  className,
}: {
  children?: React.ReactNode;
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
  className?: string;
}) {
  return (
    <a
      href="#packages"
      onClick={(e) => {
        const el = document.getElementById("packages");
        if (!el) return;
        e.preventDefault();
        const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        el.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "start" });
        history.replaceState(null, "", "#packages");
      }}
      className={cn(buttonVariants({ variant, size }), className)}
    >
      {children}
      <svg viewBox="0 0 16 16" aria-hidden className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M8 13V3M3.5 7.5 8 3l4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </a>
  );
}
