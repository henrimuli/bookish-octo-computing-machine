import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LaunchPostControls } from "@/components/admin/perk-controls";
import { ProductLogo } from "@/components/board/product-logo";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, Heading } from "@/components/ui/primitives";
import { requireStaff } from "@/lib/auth";
import { allPosts, formatPostDate } from "@/lib/blog/service";
import { openLaunchPosts } from "@/lib/perks/service";
import { TIERS } from "@/lib/products/input";
import { weekBounds, weekKeyFor } from "@/lib/weeks";

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
        <Suggested />
        <List />
      </Suspense>
    </div>
  );
}

/** Launch posts that Premium and Spotlight debuts paid for, soonest due first. */
async function Suggested() {
  await requireStaff();
  const tasks = await openLaunchPosts();
  if (tasks.length === 0) return null;
  const endOfWeek = weekBounds(weekKeyFor(new Date())).endsAt;
  return (
    <section className="mt-6">
      <h2 className="font-display text-xl font-semibold">Suggested posts</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        Launch posts paid debuts bought. Start a draft from the listing, write it up, and publishing marks it done.
      </p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {tasks.map((t) => {
          const dueSoon = t.task.status === "suggested" && t.task.dueAt !== null && t.task.dueAt < endOfWeek;
          return (
            <Card key={t.task.id} className="flex flex-col gap-3 p-4">
              <div className="flex gap-3">
                <ProductLogo name={t.name} src={t.logoUrl} className="size-10" />
                <div className="min-w-0">
                  <a href={`/p/${t.slug}`} className="font-medium hover:text-primary">
                    {t.name}
                  </a>
                  <p className="truncate text-sm text-muted-foreground">{t.tagline}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge tone="primary">{TIERS[t.tier].label}</Badge>
                {t.task.status === "drafting" && <Badge tone="success">Drafting</Badge>}
                {t.task.dueAt && (
                  <Badge className={dueSoon ? "bg-danger/10 text-danger" : undefined}>
                    {dueSoon ? "Due this week: " : "Due "}
                    {formatPostDate(t.task.dueAt)}
                  </Badge>
                )}
              </div>
              <LaunchPostControls taskId={t.task.id} postId={t.task.postId} />
            </Card>
          );
        })}
      </div>
    </section>
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
          {p.kind === "launch" && <Badge>launch</Badge>}
          <Badge tone={p.status === "published" ? "success" : "default"}>{p.status}</Badge>
          <span className="text-xs text-muted-foreground">
            {p.status === "published" ? formatPostDate(p.publishedAt) : `edited ${formatPostDate(p.updatedAt)}`}
          </span>
        </li>
      ))}
    </ul>
  );
}
