"use client";

import { useState, useTransition } from "react";
import { assignAction, deliverAction, resendBadgeBlockAction } from "@/app/admin/submissions/actions";
import { Button } from "@/components/ui/button";

export function OrderControls({
  orderId,
  assigneeId,
  staff,
  canDeliver,
}: {
  orderId: string;
  assigneeId: string | null;
  staff: Array<{ id: string; name: string }>;
  canDeliver: boolean;
}) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex items-center gap-2 text-sm">
        Assignee
        <select
          defaultValue={assigneeId ?? ""}
          disabled={pending}
          onChange={(e) =>
            start(async () => {
              const res = await assignAction(orderId, e.target.value || null);
              setMsg(res.ok ? { ok: true, text: "Assigned." } : { ok: false, text: res.error });
            })
          }
          className="h-9 rounded-md border border-border bg-card px-2 text-sm"
        >
          <option value="">Unassigned</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
      {canDeliver && (
        <Button
          size="sm"
          disabled={pending}
          onClick={() =>
            confirm("Mark delivered and email the client their report?") &&
            start(async () => {
              const res = await deliverAction(orderId);
              setMsg(res.ok ? { ok: true, text: res.message ?? "Delivered." } : { ok: false, text: res.error });
            })
          }
        >
          Mark delivered
        </Button>
      )}
      {msg && <span className={msg.ok ? "text-sm text-success" : "text-sm text-danger"}>{msg.text}</span>}
    </div>
  );
}

export function ResendBadgeBlock({ orderId }: { orderId: string }) {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await resendBadgeBlockAction(orderId);
            setMsg(res.ok ? (res.message ?? "Sent.") : res.error);
          })
        }
      >
        Email badge block
      </Button>
      {msg && <span className="text-xs text-muted-foreground">{msg}</span>}
    </span>
  );
}
