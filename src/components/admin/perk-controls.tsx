"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setBlurbAction, skipPerkAction, startLaunchDraftAction } from "@/app/admin/actions";
import { Button, ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/primitives";

type Run = (fn: () => Promise<{ ok: boolean; error?: string }>) => void;

function useRun(): [Run, boolean, string | null] {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run: Run = (fn) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Failed");
    });
  return [run, pending, error];
}

/** "Skip…" opens a reason field; the reason is kept on the task. */
function Skip({ taskId, run, pending }: { taskId: string; run: Run; pending: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  if (!open) {
    return (
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => setOpen(true)}>
        Skip…
      </Button>
    );
  }
  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      <Input
        className="h-8 min-w-48 flex-1"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Why it's skipped (e.g. refunded, maker asked)"
        aria-label="Reason for skipping"
        autoFocus
      />
      <Button size="sm" variant="outline" disabled={pending} onClick={() => run(() => skipPerkAction(taskId, reason))}>
        Confirm skip
      </Button>
      <Button size="sm" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
        Cancel
      </Button>
    </div>
  );
}

/** A newsletter mention: edit the line that goes out (empty uses the tagline), or skip it. */
export function MentionControls({ taskId, blurb, tagline }: { taskId: string; blurb: string | null; tagline: string }) {
  const [run, pending, error] = useRun();
  const [value, setValue] = useState(blurb ?? "");
  const dirty = value.trim() !== (blurb ?? "");
  return (
    <div className="space-y-2">
      <textarea
        className="w-full rounded-md border border-border bg-card p-2 text-sm placeholder:text-muted-foreground"
        rows={2}
        maxLength={280}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={tagline}
        aria-label="Newsletter blurb"
      />
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={pending || !dirty}
          onClick={() => run(() => setBlurbAction(taskId, value))}
        >
          Save blurb
        </Button>
        <Skip taskId={taskId} run={run} pending={pending} />
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}

/** A launch post: start the draft (then open it), or skip it. */
export function LaunchPostControls({ taskId, postId }: { taskId: string; postId: string | null }) {
  const [run, pending, error] = useRun();
  const router = useRouter();
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {postId ? (
          <ButtonLink size="sm" href={`/admin/blog/${postId}`}>
            Open draft
          </ButtonLink>
        ) : (
          <Button
            size="sm"
            disabled={pending}
            onClick={() =>
              run(async () => {
                const res = await startLaunchDraftAction(taskId);
                if (res.ok) router.push(`/admin/blog/${res.id}`);
                return res;
              })
            }
          >
            Start draft
          </Button>
        )}
        {/* Room for a "Write with Gemini" button once drafting is automated. */}
        <Skip taskId={taskId} run={run} pending={pending} />
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
