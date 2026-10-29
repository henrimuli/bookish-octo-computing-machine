"use client";

import Link from "next/link";
import { useState } from "react";
import type { FreeTool } from "@/components/tools/tool-list";
import { cn } from "@/lib/utils";

/**
 * The header's Free Tools panel: opens on hover, or on focus for keyboard and
 * touch. Picking a tool closes it (the page changes under a still-hovering
 * pointer and a focused link, so CSS alone would keep it open) until the
 * pointer leaves.
 */
export function FreeToolsMenu({ tools }: { tools: FreeTool[] }) {
  const [closed, setClosed] = useState(false);
  const open = closed ? "" : "group-hover/tools:visible group-hover/tools:translate-y-0 group-hover/tools:opacity-100";
  const focusOpen = closed
    ? ""
    : "group-focus-within/tools:visible group-focus-within/tools:translate-y-0 group-focus-within/tools:opacity-100";
  return (
    <div className="group/tools relative" onMouseLeave={() => setClosed(false)} onFocus={() => setClosed(false)}>
      <button
        type="button"
        aria-haspopup="true"
        className="inline-flex h-16 items-center gap-1 hover:text-foreground group-focus-within/tools:text-foreground"
      >
        Free Tools
        <svg
          viewBox="0 0 16 16"
          aria-hidden
          className={cn(
            "size-3.5 transition-transform",
            !closed && "group-hover/tools:rotate-180 group-focus-within/tools:rotate-180",
          )}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m4 6 4 4 4-4" />
        </svg>
      </button>
      <div
        className={cn(
          "invisible absolute left-1/2 top-full w-96 -translate-x-1/2 translate-y-1 opacity-0 transition duration-150",
          open,
          focusOpen,
        )}
      >
        <ul className="space-y-1 rounded-2xl border border-border bg-card p-2 shadow-xl">
          {tools.map((t) => (
            <li key={t.href}>
              <Link
                href={t.href}
                onClick={(e) => {
                  e.currentTarget.blur();
                  setClosed(true);
                }}
                className="group/item flex gap-3.5 rounded-xl p-3 transition-colors hover:bg-muted"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary transition-colors group-hover/item:bg-primary group-hover/item:text-primary-foreground">
                  {t.icon}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">{t.label}</span>
                  <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{t.description}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
