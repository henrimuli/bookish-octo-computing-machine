"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { pulseAction } from "@/app/admin/email/actions";

/**
 * One shared poll of the support inbox for the whole admin, however many
 * components listen: every 15 seconds while the tab is visible, and at once
 * when it becomes visible again.
 */
type Pulse = { unread: number; latest: string | null };
let pulse: Pulse | null = null;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;
let inFlight = false;

/** Asks for fresh numbers now, e.g. after opening a conversation marks it read. */
export async function pollInbox() {
  if (inFlight || document.hidden) return;
  inFlight = true;
  try {
    const next = await pulseAction();
    if (next && (next.unread !== pulse?.unread || next.latest !== pulse?.latest)) {
      pulse = next;
      listeners.forEach((l) => l());
    }
  } catch {
    // Offline or signed out: try again on the next tick.
  } finally {
    inFlight = false;
  }
}

const onVisible = () => {
  if (!document.hidden) void pollInbox();
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    void pollInbox();
    timer = setInterval(pollInbox, 15_000);
    document.addEventListener("visibilitychange", onVisible);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    }
  };
}

const usePulse = () =>
  useSyncExternalStore(
    subscribe,
    () => pulse,
    () => null,
  );

/** Unread conversations, beside "Email" in the admin sidebar. */
export function InboxBadge({ initial }: { initial: number }) {
  const n = usePulse()?.unread ?? initial;
  if (!n) return null;
  return (
    <span className="ml-auto min-w-5 rounded-full bg-primary px-1.5 text-center text-[11px] font-semibold leading-5 text-primary-foreground">
      {n > 99 ? "99+" : n}
    </span>
  );
}

/** Re-renders the inbox page when new mail arrives, without a reload. */
export function LiveRefresh() {
  const router = useRouter();
  const latest = usePulse()?.latest ?? null;
  const prev = useRef(latest);
  useEffect(() => {
    // The first value is what the page was rendered with; only later changes are new mail.
    if (prev.current && latest && latest !== prev.current) router.refresh();
    prev.current = latest;
  }, [latest, router]);
  return null;
}
