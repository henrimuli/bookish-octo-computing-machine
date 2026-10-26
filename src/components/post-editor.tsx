"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deletePostAction, previewAction, savePostAction, setPublishedAction } from "@/app/admin/blog/actions";
import { Button } from "@/components/ui/button";
import { Badge, Input, Label } from "@/components/ui/primitives";

type Initial = {
  id: string | null;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  coverUrl: string;
  status: "draft" | "published";
  kind: "post" | "recap";
};

export function PostEditor({ initial }: { initial: Initial }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [preview, setPreview] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = (k: keyof Initial) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function save(then?: (id: string) => Promise<void>) {
    setMessage(null);
    start(async () => {
      const { id, title, slug, excerpt, body, coverUrl } = form;
      const res = await savePostAction({ title, slug, excerpt, body, coverUrl }, id);
      if (!res.ok) return setMessage({ ok: false, text: res.error });
      setForm((f) => ({ ...f, id: res.id, slug: res.slug }));
      if (then) await then(res.id);
      else setMessage({ ok: true, text: "Saved." });
      if (!id) router.replace(`/admin/blog/${res.id}`);
    });
  }

  function togglePublished() {
    const next = form.status !== "published";
    save(async (id) => {
      const res = await setPublishedAction(id, next);
      if (!res.ok) return setMessage({ ok: false, text: res.error });
      setForm((f) => ({ ...f, status: next ? "published" : "draft" }));
      setMessage({ ok: true, text: next ? "Published." : "Moved back to drafts." });
    });
  }

  function showPreview() {
    setTab("preview");
    start(async () => setPreview(await previewAction(form.body)));
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={form.status === "published" ? "success" : "default"}>{form.status}</Badge>
        {form.kind === "recap" && <Badge>weekly recap</Badge>}
        {form.status === "published" && (
          <Link href={`/blog/${form.slug}`} target="_blank" className="text-sm text-primary hover:underline">
            View post ↗
          </Link>
        )}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="title">Title</Label>
        <Input id="title" value={form.title} onChange={set("title")} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="slug">Slug</Label>
          <Input id="slug" value={form.slug} onChange={set("slug")} placeholder="from the title" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cover">Cover image URL</Label>
          <Input id="cover" value={form.coverUrl} onChange={set("coverUrl")} placeholder="https://…" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="excerpt">Excerpt</Label>
        <Input id="excerpt" value={form.excerpt} onChange={set("excerpt")} placeholder="from the body" />
      </div>
      <div>
        <div className="mb-2 flex gap-4 text-sm">
          <button
            type="button"
            onClick={() => setTab("write")}
            className={tab === "write" ? "font-semibold" : "text-muted-foreground"}
          >
            Write
          </button>
          <button
            type="button"
            onClick={showPreview}
            className={tab === "preview" ? "font-semibold" : "text-muted-foreground"}
          >
            Preview
          </button>
          <span className="ml-auto text-xs text-muted-foreground">Markdown. Raw HTML is shown as text.</span>
        </div>
        {tab === "write" ? (
          <textarea
            value={form.body}
            onChange={set("body")}
            rows={24}
            className="w-full rounded-md border border-border bg-card p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        ) : (
          <div
            className="prose-dy min-h-96 rounded-md border border-border bg-card p-5"
            dangerouslySetInnerHTML={{ __html: preview }}
          />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={() => save()} disabled={pending}>
          Save
        </Button>
        <Button variant="outline" onClick={togglePublished} disabled={pending}>
          {form.status === "published" ? "Unpublish" : "Save and publish"}
        </Button>
        {form.id && (
          <Button
            variant="ghost"
            className="ml-auto text-danger"
            disabled={pending}
            onClick={() => confirm("Delete this post?") && start(() => deletePostAction(form.id!))}
          >
            Delete
          </Button>
        )}
        {message && <p className={message.ok ? "text-sm text-success" : "text-sm text-danger"}>{message.text}</p>}
      </div>
    </div>
  );
}
