import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import { Suspense } from "react";
import { TrackerTable } from "@/components/directories/tracker-table";
import { ButtonLink } from "@/components/ui/button";
import { Card, Container, Heading } from "@/components/ui/primitives";
import { db, schema } from "@/db";
import { requireUser } from "@/lib/auth";
import { effectiveLinkType } from "@/lib/directories/service";
import { summarize, trackerRows } from "@/lib/directories/tracker";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Directory tracker", robots: { index: false } };

export default function TrackerPage(props: PageProps<"/dashboard/tracker">) {
  return (
    <Container className="max-w-5xl py-12">
      <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
        ← Dashboard
      </Link>
      <Heading className="mt-4">Directory tracker</Heading>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Work through the directories at your own pace. When a listing goes live, paste its URL and we check the link
        ourselves: that the page loads, links to your site, and whether the link is dofollow.
      </p>
      <Suspense fallback={<div className="mt-8 h-96 animate-pulse rounded-lg bg-muted/50" />}>
        <Tracker searchParams={props.searchParams} />
      </Suspense>
    </Container>
  );
}

async function Tracker({ searchParams }: Pick<PageProps<"/dashboard/tracker">, "searchParams">) {
  const user = await requireUser("/dashboard/tracker");
  const { product } = await searchParams;
  const mine = await db()
    .select({ id: schema.products.id, name: schema.products.name })
    .from(schema.products)
    .where(
      and(eq(schema.products.createdBy, user.id), inArray(schema.products.status, ["draft", "pending", "approved"])),
    )
    .orderBy(desc(schema.products.createdAt));

  if (mine.length === 0) {
    return (
      <Card className="mt-8 text-center">
        <p className="font-medium">Add your product first.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          The tracker works per product, so we know which site to check links for.
        </p>
        <ButtonLink href="/submit" className="mt-4">
          Add your product
        </ButtonLink>
      </Card>
    );
  }
  const current = mine.find((p) => p.id === product) ?? mine[0];
  const rows = await trackerRows(user.id, current.id);
  const s = summarize(rows);

  return (
    <div className="mt-8 space-y-6">
      {mine.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {mine.map((p) => (
            <Link
              key={p.id}
              href={`/dashboard/tracker?product=${p.id}`}
              className={cn(
                "rounded-md border px-3 py-1.5 text-sm",
                p.id === current.id
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border hover:border-foreground/30",
              )}
            >
              {p.name}
            </Link>
          ))}
        </div>
      )}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Live", s.live],
          ["Verified dofollow", s.dofollow],
          ["Submitted", s.submitted],
          ["To do", s.todo],
        ].map(([label, n]) => (
          <Card key={label} className="p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="font-display text-2xl font-bold">{n}</p>
          </Card>
        ))}
      </div>
      <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm">
          <span className="font-medium">No time for {s.todo} forms?</span>{" "}
          <span className="text-muted-foreground">We submit by hand and verify every link, from $99.</span>
        </p>
        <ButtonLink href={`/submission-service?product=${current.id}`} size="sm">
          Have us do it
        </ButtonLink>
      </Card>
      <Card className="p-5">
        <TrackerTable
          productId={current.id}
          rows={rows.map(({ directory: d, submission }) => ({
            directory: {
              id: d.id,
              slug: d.slug,
              name: d.name,
              url: d.url,
              submitUrl: d.submitUrl,
              dr: d.dr,
              niche: d.niche,
              pricing: d.pricing,
              badgeRequired: d.badgeRequired,
              guided: d.guided,
              link: effectiveLinkType(d),
            },
            submission: submission && {
              id: submission.id,
              status: submission.status,
              liveUrl: submission.liveUrl,
              linkVerdict: submission.linkVerdict,
              linkAnchor: submission.linkAnchor,
              linkCheckedAt: submission.linkCheckedAt,
            },
          }))}
        />
      </Card>
    </div>
  );
}
