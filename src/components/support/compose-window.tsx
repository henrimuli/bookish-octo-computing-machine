"use client";

import { useState } from "react";
import { Icon } from "@/components/app-shell/icons";
import { cn } from "@/lib/utils";
import { Composer } from "./composer";

/**
 * The Compose button and its floating "New message" window, docked
 * bottom-right like Gmail's: it can be minimised to its title bar while you
 * read other mail, and fills the screen on phones.
 */
export function ComposeLauncher({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [minimised, setMinimised] = useState(false);
  // A fresh key per window resets the fields after sending or discarding.
  const [key, setKey] = useState(0);

  const close = () => {
    setOpen(false);
    setMinimised(false);
    setKey((k) => k + 1);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          setMinimised(false);
        }}
        className={cn(
          "inline-flex h-12 items-center gap-3 rounded-2xl bg-primary/15 px-5 text-sm font-semibold text-foreground shadow-sm transition-shadow hover:shadow-md",
          className,
        )}
      >
        <Icon name="pen" className="size-5" />
        Compose
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="New message"
          className={cn(
            "fixed z-40 flex flex-col overflow-hidden border border-border bg-card shadow-2xl",
            minimised
              ? "bottom-0 right-4 w-72 rounded-t-xl"
              : "inset-0 sm:inset-auto sm:bottom-0 sm:right-6 sm:h-[34rem] sm:max-h-[calc(100dvh-2rem)] sm:w-[34rem] sm:rounded-t-xl",
          )}
        >
          <div className="flex items-center gap-1 bg-foreground px-3 py-2 text-background">
            <button
              type="button"
              onClick={() => setMinimised((m) => !m)}
              className="flex-1 truncate text-left text-sm font-medium"
            >
              New message
            </button>
            <button
              type="button"
              aria-label={minimised ? "Expand" : "Minimise"}
              onClick={() => setMinimised((m) => !m)}
              className="rounded p-1 opacity-80 hover:bg-background/15 hover:opacity-100"
            >
              <Icon name="minus" />
            </button>
            <button
              type="button"
              aria-label="Close"
              onClick={close}
              className="rounded p-1 opacity-80 hover:bg-background/15 hover:opacity-100"
            >
              <Icon name="close" />
            </button>
          </div>
          <Composer
            key={key}
            mode="new"
            initial={{ to: [], cc: [], subject: "" }}
            onDone={close}
            className={cn("flex-1", minimised && "hidden")}
          />
        </div>
      )}
    </>
  );
}
