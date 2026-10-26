"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { setLaunchWallAction } from "@/app/dashboard/links/actions";

/** Opt in to showing your verified links publicly. */
export function LaunchWallToggle({ on, handle }: { on: boolean; handle: string | null }) {
  const [value, setValue] = useState(on);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-1">
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          className="mt-1"
          checked={value}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.checked;
            setValue(next);
            setError(null);
            start(async () => {
              const res = await setLaunchWallAction(next);
              if (!res.ok) {
                setValue(!next);
                setError(res.error);
              }
            });
          }}
        />
        <span>
          <span className="font-medium">Show my verified links on the launch wall</span>
          <span className="block text-muted-foreground">
            Lists the live links our checks have confirmed on{" "}
            <Link href="/launch-wall" className="text-primary hover:underline">
              /launch-wall
            </Link>
            {handle && (
              <>
                {" "}
                and{" "}
                <Link href={`/builders/${handle}`} className="text-primary hover:underline">
                  your profile
                </Link>
              </>
            )}
            . Links you haven&apos;t verified, and missing ones, are never shown.
          </span>
        </span>
      </label>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
