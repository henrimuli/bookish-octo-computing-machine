"use client";

import { useEffect } from "react";

/** Counts one impression per sponsored slot per browser session. */
export function AdImpressions({ ids }: { ids: string[] }) {
  const key = ids.join(",");
  useEffect(() => {
    const fresh = key.split(",").filter((id) => {
      if (!id) return false;
      try {
        if (sessionStorage.getItem(`ad:${id}`)) return false;
        sessionStorage.setItem(`ad:${id}`, "1");
      } catch {}
      return true;
    });
    if (fresh.length === 0) return;
    const payload = JSON.stringify({ ids: fresh });
    if (navigator.sendBeacon)
      navigator.sendBeacon("/api/ads/impressions", new Blob([payload], { type: "application/json" }));
    else void fetch("/api/ads/impressions", { method: "POST", body: payload, keepalive: true });
  }, [key]);
  return null;
}
