"use client";

import { useCallback, useEffect, useRef } from "react";

type Turnstile = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string;
  execute: (widgetId: string) => void;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<Turnstile> | null = null;

function loadTurnstile(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile didn't load")));
    s.onerror = () => {
      loading = null;
      reject(new Error("Turnstile didn't load"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

/**
 * Cloudflare Turnstile, invisible: nothing shows unless Cloudflare needs the
 * visitor to click (then a small box appears in `containerRef`). `getToken` runs
 * the check and resolves with a fresh single-use token, or null without a site
 * key (development) or when the check fails.
 */
export function useTurnstile(siteKey: string | null) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widget = useRef<{ api: Turnstile; id: string } | null>(null);
  const waiting = useRef<((token: string | null) => void) | null>(null);

  useEffect(() => {
    if (!siteKey) return;
    let cancelled = false;
    const settle = (token: string | null) => {
      waiting.current?.(token);
      waiting.current = null;
    };
    loadTurnstile()
      .then((api) => {
        if (cancelled || !containerRef.current) return;
        const id = api.render(containerRef.current, {
          sitekey: siteKey,
          execution: "execute",
          appearance: "interaction-only",
          callback: (token: string) => settle(token),
          "error-callback": () => settle(null),
          "expired-callback": () => settle(null),
        });
        widget.current = { api, id };
      })
      .catch(() => settle(null));
    return () => {
      cancelled = true;
      if (widget.current) widget.current.api.remove(widget.current.id);
      widget.current = null;
    };
  }, [siteKey]);

  const getToken = useCallback(async (): Promise<string | null> => {
    if (!siteKey) return null;
    // The widget may still be loading on a fast first submit.
    for (let i = 0; i < 50 && !widget.current; i++) await new Promise((r) => setTimeout(r, 100));
    const w = widget.current;
    if (!w) return null;
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), 30_000);
      waiting.current = (token) => {
        clearTimeout(timer);
        resolve(token);
      };
      // Tokens are single-use: reset before each run so a second check gets a new one.
      w.api.reset(w.id);
      w.api.execute(w.id);
    });
  }, [siteKey]);

  return { containerRef, getToken };
}
