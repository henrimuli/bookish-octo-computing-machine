"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addCommentAction, removeCommentAction } from "@/app/(site)/p/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";

export type CommentView = {
  id: string;
  parentId: string | null;
  body: string;
  createdAt: string;
  userId: string;
  name: string;
  handle: string | null;
  isMaker: boolean;
  canDelete: boolean;
};

function CommentBox({
  productId,
  parentId,
  onDone,
  placeholder,
}: {
  productId: string;
  parentId?: string;
  onDone?: () => void;
  placeholder: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await addCommentAction(productId, body, parentId);
      if (!res.ok) {
        if (res.needsAuth) router.push(`/sign-in?next=${encodeURIComponent(pathname)}`);
        else setError(res.error);
        return;
      }
      setBody("");
      onDone?.();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={parentId ? 2 : 3}
        maxLength={2000}
        placeholder={placeholder}
        className="w-full rounded-md border border-border bg-card p-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={pending || body.trim().length < 2}>
          {pending ? "Posting…" : parentId ? "Reply" : "Comment"}
        </Button>
        {error && <span className="text-sm text-danger">{error}</span>}
      </div>
    </form>
  );
}

function Comment({ c, productId, replies }: { c: CommentView; productId: string; replies: CommentView[] }) {
  const [replying, setReplying] = useState(false);
  const [, start] = useTransition();
  return (
    <li className="space-y-2">
      <div className="text-sm">
        <span className="font-medium">{c.name}</span>
        {c.isMaker && (
          <Badge tone="primary" className="ml-2">
            Maker
          </Badge>
        )}
        <span className="ml-2 text-xs text-muted-foreground">{new Date(c.createdAt).toLocaleDateString()}</span>
      </div>
      <p className="whitespace-pre-line text-sm">{c.body}</p>
      <div className="flex gap-3 text-xs text-muted-foreground">
        {!c.parentId && (
          <button type="button" onClick={() => setReplying((r) => !r)} className="hover:text-foreground">
            Reply
          </button>
        )}
        {c.canDelete && (
          <button
            type="button"
            onClick={() => start(async () => void (await removeCommentAction(c.id)))}
            className="hover:text-danger"
          >
            Delete
          </button>
        )}
      </div>
      {replying && (
        <CommentBox
          productId={productId}
          parentId={c.id}
          placeholder="Write a reply"
          onDone={() => setReplying(false)}
        />
      )}
      {replies.length > 0 && (
        <ul className="ml-4 space-y-4 border-l border-border pl-4">
          {replies.map((r) => (
            <Comment key={r.id} c={r} productId={productId} replies={[]} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function Comments({ productId, comments, live }: { productId: string; comments: CommentView[]; live: boolean }) {
  const roots = comments.filter((c) => !c.parentId);
  return (
    <section className="space-y-6">
      <h2 className="font-display text-xl font-semibold">Discussion ({comments.length})</h2>
      {live ? (
        <CommentBox productId={productId} placeholder="What do you think? Questions and feedback help makers most." />
      ) : (
        <p className="text-sm text-muted-foreground">Comments open when the product debuts.</p>
      )}
      <ul className="space-y-6">
        {roots.map((c) => (
          <Comment key={c.id} c={c} productId={productId} replies={comments.filter((r) => r.parentId === c.id)} />
        ))}
      </ul>
    </section>
  );
}
