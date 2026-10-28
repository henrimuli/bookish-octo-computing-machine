"use client";

import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import { ButtonLink } from "@/components/ui/button";

/**
 * Opens the debut modal. On the homepage it just adds `?debut=1` to the URL
 * (no server round-trip); elsewhere it navigates to the homepage with it.
 */
export function DebutLink(props: Omit<ComponentProps<typeof ButtonLink>, "href">) {
  const pathname = usePathname();
  return (
    <ButtonLink
      {...props}
      href="/?debut=1"
      scroll={false}
      onClick={(e) => {
        props.onClick?.(e);
        if (pathname !== "/" || e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        window.history.pushState(null, "", "/?debut=1");
      }}
    />
  );
}
