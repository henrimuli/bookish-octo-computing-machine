"use client";

import { useSyncExternalStore } from "react";
import { applyTheme, readTheme, THEME_KEY, type ThemeChoice } from "@/lib/theme";
import { cn } from "@/lib/utils";

const options: { value: ThemeChoice; label: string; path: string }[] = [
  { value: "system", label: "System theme", path: "M4 5h16v11H4V5Zm4 15h8m-4-4v4" },
  {
    value: "light",
    label: "Light theme",
    path: "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm0-14v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32 1.41-1.41",
  },
  { value: "dark", label: "Dark theme", path: "M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" },
];

// Same-tab changes don't fire "storage", so the switcher announces its own.
const CHANGE = "debutyard:theme-change";

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key !== THEME_KEY) return;
    applyTheme(readTheme());
    onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE, onChange);
  };
}

/** System / light / dark, as three icon buttons. Applies to the whole site, not just the dashboard. */
export function ThemeSwitcher() {
  const current = useSyncExternalStore(subscribe, readTheme, () => "system" as const);
  return (
    <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-md border border-border p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={current === o.value}
          aria-label={o.label}
          title={o.label}
          onClick={() => {
            applyTheme(o.value);
            window.dispatchEvent(new Event(CHANGE));
          }}
          className={cn(
            "grid size-7 place-items-center rounded text-muted-foreground hover:text-foreground",
            current === o.value && "bg-muted text-foreground",
          )}
        >
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-4"
          >
            <path d={o.path} />
          </svg>
        </button>
      ))}
    </div>
  );
}
