"use client";

import { useEffect, useRef } from "react";

function beacon(productId: string, kind: "view" | "outbound_click") {
  const payload = JSON.stringify({ productId, kind, referrer: document.referrer || undefined });
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/events", new Blob([payload], { type: "application/json" }));
  } else {
    void fetch("/api/events", {
      method: "POST",
      body: payload,
      keepalive: true,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/** Records one view per page load. */
export function ViewBeacon({ productId }: { productId: string }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    beacon(productId, "view");
  }, [productId]);
  return null;
}

/**
 * The listing's link to the maker's site. It points straight at their URL
 * (a redirect would pass no link equity) and reports the click separately.
 */
export function VisitLink({
  productId,
  href,
  rel,
  className,
  children,
}: {
  productId: string;
  href: string;
  rel: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a href={href} rel={rel} target="_blank" className={className} onClick={() => beacon(productId, "outbound_click")}>
      {children}
    </a>
  );
}
