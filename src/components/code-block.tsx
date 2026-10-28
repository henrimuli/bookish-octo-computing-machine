"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Code that wraps instead of scrolling sideways: line breaks and indentation
 * are kept, and long tokens (URLs, HTML attributes) break wherever they need
 * to. Optional copy button in the corner.
 */
export function CodeBlock({ code, copy = true, className }: { code: string; copy?: boolean; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={cn("group relative rounded-lg bg-muted", className)}>
      <pre
        className={cn(
          "whitespace-pre-wrap p-4 font-mono text-xs leading-relaxed [overflow-wrap:anywhere]",
          copy && "pr-16",
        )}
      >
        <code>{code}</code>
      </pre>
      {copy && (
        <button
          type="button"
          onClick={() =>
            void navigator.clipboard.writeText(code).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            })
          }
          className="absolute right-2 top-2 rounded-md border border-border bg-card px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      )}
    </div>
  );
}
