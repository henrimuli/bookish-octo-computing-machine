import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Heading } from "@/components/ui/primitives";
import { requireStaff } from "@/lib/auth";
import { allPosts, formatPostDate } from "@/lib/blog/service";

export const metadata: Metadata = { title: "Blog · Admin", robots: { index: false } };

export default function BlogAdminPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-center justify-between gap-4">
        <Heading className="text-2xl sm:text-3xl">Blog</Heading>
        <ButtonLink href="/admin/blog/new">New post</ButtonLink>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        A recap draft is written automatically after each week closes. Add a line about each winner, then publish.
      </p>
      <Suspense fallback={<p className="mt-8 text-muted-foreground">Loading…</p>}>
        <List />
      </Suspense>
    </div>
  );
}

async function List() {
  await requireStaff();
  const posts = await allPosts();
  if (posts.length === 0) return <p className="mt-8 text-muted-foreground">No posts yet.</p>;
  return (
    <ul className="mt-6 divide-y divide-border rounded-lg border border-border">
      {posts.map((p) => (
        <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
          <Link href={`/admin/blog/${p.id}`} className="min-w-0 flex-1 truncate font-medium hover:text-primary">
            {p.title}
          </Link>
          {p.kind === "recap" && <Badge>recap</Badge>}
          <Badge tone={p.status === "published" ? "success" : "default"}>{p.status}</Badge>
          <span className="text-xs text-muted-foreground">
            {p.status === "published" ? formatPostDate(p.publishedAt) : `edited ${formatPostDate(p.updatedAt)}`}
          </span>
        </li>
      ))}
    </ul>
  );
}
