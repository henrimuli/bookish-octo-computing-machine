"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/app-shell/icons";
import { cn } from "@/lib/utils";

/**
 * The editor's content as the plain text the email template reads: one line
 * per line, blank lines between paragraphs, and links as [label](url).
 */
function toBody(root: HTMLElement): string {
  let out = "";
  const walk = (n: Node) => {
    if (n.nodeType === Node.TEXT_NODE) {
      out += n.textContent ?? "";
      return;
    }
    if (!(n instanceof HTMLElement)) return;
    if (n.tagName === "BR") {
      out += "\n";
      return;
    }
    if (n.tagName === "A") {
      const label = (n.textContent ?? "").replace(/[[\]]/g, "");
      const href = (n.getAttribute("href") ?? "").replace(/\)/g, "%29");
      out += label.trim() && href ? `[${label}](${href})` : label;
      return;
    }
    const block = /^(DIV|P|LI)$/.test(n.tagName);
    if (block && out && !out.endsWith("\n")) out += "\n";
    n.childNodes.forEach(walk);
    if (block && !out.endsWith("\n")) out += "\n";
  };
  root.childNodes.forEach(walk);
  return out.replace(/ /g, " ").replace(/\n+$/, "");
}

/** "example.com" → "https://example.com"; mailto: and full URLs stay as they are. */
function normaliseUrl(raw: string): string | null {
  const url = raw.trim();
  if (!url) return null;
  if (/^(https?:|mailto:)/i.test(url)) return url;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(url)) return `mailto:${url}`;
  return `https://${url.replace(/^\/+/, "")}`;
}

type Bar = { top: number; left: number; link: HTMLAnchorElement | null };

/**
 * The message box: plain writing, plus links. Select some text and a small
 * toolbar offers "Link" (or Ctrl/Cmd+K); paste a URL, press Enter, and the text
 * turns into a coloured link. Clicking a link offers to change or remove it.
 */
export function BodyEditor({
  onChange,
  onSubmit,
  autoFocus,
  className,
}: {
  onChange: (body: string) => void;
  /** Ctrl/Cmd+Enter. */
  onSubmit: () => void;
  autoFocus?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [empty, setEmpty] = useState(true);
  const [bar, setBar] = useState<Bar | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  // The selection to turn into a link, kept while focus is in the URL field.
  const saved = useRef<{ range: Range; link: HTMLAnchorElement | null } | null>(null);

  const sync = () => {
    const body = toBody(ref.current!);
    setEmpty(!body.trim());
    onChange(body);
  };

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
    const onSelection = () => {
      if (saved.current) return; // typing a URL: keep the toolbar where it is
      const sel = document.getSelection();
      const el = ref.current;
      if (!sel || !el || !sel.rangeCount) return setBar(null);
      const range = sel.getRangeAt(0);
      if (!el.contains(range.commonAncestorContainer)) return setBar(null);
      const node = range.startContainer;
      const link = (node instanceof Element ? node : node.parentElement)?.closest("a") ?? null;
      if (range.collapsed && !link) return setBar(null);
      const rect = (range.collapsed && link ? link : range).getBoundingClientRect();
      setBar({ top: rect.top, left: rect.left + rect.width / 2, link: link && el.contains(link) ? link : null });
    };
    document.addEventListener("selectionchange", onSelection);
    return () => document.removeEventListener("selectionchange", onSelection);
  }, [autoFocus]);

  const startLink = () => {
    const sel = document.getSelection();
    if (!sel?.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed && !bar?.link) return;
    saved.current = { range: range.cloneRange(), link: bar?.link ?? null };
    setUrl(bar?.link?.getAttribute("href") ?? "");
  };

  const finish = () => {
    saved.current = null;
    setUrl(null);
    setBar(null);
  };

  const applyLink = () => {
    const target = saved.current;
    const href = normaliseUrl(url ?? "");
    if (!target) return finish();
    if (target.link) {
      if (href) target.link.setAttribute("href", href);
    } else if (href) {
      const a = document.createElement("a");
      a.href = href;
      a.appendChild(target.range.extractContents());
      target.range.insertNode(a);
      // Carry on typing after the link, not inside it.
      const after = document.createRange();
      after.setStartAfter(a);
      after.collapse(true);
      const sel = document.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(after);
    }
    finish();
    ref.current?.focus();
    sync();
  };

  const removeLink = () => {
    const link = bar?.link;
    if (link) {
      link.replaceWith(...Array.from(link.childNodes));
      sync();
    }
    finish();
  };

  return (
    <div className={cn("relative", className)}>
      {empty && (
        <p className="pointer-events-none absolute inset-x-3 top-3 text-sm leading-relaxed text-muted-foreground">
          Write your message… Select text to add a link.
        </p>
      )}
      <div
        ref={ref}
        role="textbox"
        aria-multiline
        aria-label="Message"
        contentEditable
        suppressContentEditableWarning
        onInput={sync}
        onPaste={(e) => {
          // Pasted text arrives plain: no stray fonts or colours from elsewhere.
          e.preventDefault();
          document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
        }}
        onKeyDown={(e) => {
          const mod = e.metaKey || e.ctrlKey;
          if (mod && e.key === "Enter") {
            e.preventDefault();
            onSubmit();
          } else if (mod && e.key.toLowerCase() === "k") {
            e.preventDefault();
            startLink();
          }
        }}
        className="h-full min-h-40 overflow-y-auto whitespace-pre-wrap break-words px-3 py-3 text-sm leading-relaxed outline-none [&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2"
      />
      {bar &&
        createPortal(
          <div
            role="toolbar"
            aria-label="Link"
            style={{ top: Math.max(8, bar.top - 44), left: bar.left }}
            // Keep the text selected while using the toolbar.
            onMouseDown={(e) => {
              if (!(e.target instanceof HTMLInputElement)) e.preventDefault();
            }}
            className="fixed z-50 flex -translate-x-1/2 items-center gap-1 rounded-lg border border-border bg-card p-1 text-sm shadow-lg"
          >
            {url !== null ? (
              <form
                className="flex items-center gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  applyLink();
                }}
              >
                <input
                  autoFocus
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onBlur={finish}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") {
                      finish();
                      ref.current?.focus();
                    }
                  }}
                  placeholder="Paste or type a link"
                  aria-label="Link address"
                  className="h-8 w-56 rounded-md border border-border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <button
                  type="submit"
                  className="h-8 rounded-md bg-primary px-3 font-medium text-primary-foreground hover:bg-primary/90"
                >
                  Apply
                </button>
              </form>
            ) : bar.link ? (
              <>
                <a
                  href={bar.link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="max-w-56 truncate px-2 text-primary hover:underline"
                >
                  {bar.link.getAttribute("href")}
                </a>
                <button type="button" onClick={startLink} className="h-8 rounded-md px-2 hover:bg-muted">
                  Change
                </button>
                <button type="button" onClick={removeLink} className="h-8 rounded-md px-2 hover:bg-muted">
                  Remove
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={startLink}
                className="flex h-8 items-center gap-1.5 rounded-md px-2 font-medium hover:bg-muted"
              >
                <Icon name="links" />
                Link
              </button>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
