import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LinksTable } from "@/components/links/links-table";
import { ButtonLink } from "@/components/ui/button";
import { Card, Container, Heading } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth";
import { linksForUser, linkUsage, pausedLinkIds } from "@/lib/links/service";

export const metadata: Metadata = { title: "Link Monitor", robots: { index: false } };

export default function LinksPage() {
  return (
    <Container className="max-w-5xl py-12">
      <Link href="/dashboard" className="text-sm text-muted-foreground hover:text-foreground">
        ← Dashboard
      </Link>
      <Heading className="mt-4">Link Monitor</Heading>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        We re-check every live backlink: daily for its first two weeks, then weekly. If a link turns nofollow or a
        listing disappears, we email you. Links from your directory tracker and submission orders are added
        automatically.
      </p>
      <Suspense fallback={<div className="mt-8 h-96 animate-pulse rounded-lg bg-muted/50" />}>
        <Links />
      </Suspense>
    </Container>
  );
}

async function Links() {
  const user = await requireUser("/dashboard/links");
  const [rows, usage, paused] = await Promise.all([linksForUser(user.id), linkUsage(user.id), pausedLinkIds(user.id)]);
  const active = rows.filter((r) => r.link.active);
  const n = (v: string) => active.filter((r) => r.link.lastVerdict === v).length;
  const attention = active.filter((r) => r.link.lastVerdict && r.link.lastVerdict !== "dofollow").length;

  return (
    <div className="mt-8 space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Monitored", usage.monitored],
          ["Dofollow", n("dofollow")],
          ["Need attention", attention],
          ["Your added links", `${usage.used} / ${usage.limit}`],
        ].map(([label, value]) => (
          <Card key={label} className="p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="font-display text-2xl font-bold">{value}</p>
          </Card>
        ))}
      </div>
      {(usage.used >= usage.limit || paused.size > 0) && (
        <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">
            <span className="font-medium">
              {paused.size > 0
                ? `${paused.size} of your links are over your plan and aren't being checked.`
                : `You've used all ${usage.limit} links on your plan.`}
            </span>{" "}
            <span className="text-muted-foreground">Link Monitor covers 100 links for $9/month, or 500 for $19.</span>
          </p>
          <ButtonLink href="/pricing#plans" size="sm">
            See plans
          </ButtonLink>
        </Card>
      )}
      <Card className="p-5">
        <LinksTable
          canAdd={usage.used < usage.limit}
          rows={rows.map(({ link: l, directory }) => ({
            id: l.id,
            url: l.url,
            target: l.targetDomain,
            directory,
            source: l.source,
            active: l.active,
            paused: paused.has(l.id),
            verdict: l.lastVerdict,
            anchor: l.lastAnchor,
            statusCode: l.lastStatusCode,
            checkedAt: l.lastCheckedAt,
            nextCheckAt: l.active ? l.nextCheckAt : null,
          }))}
        />
      </Card>
    </div>
  );
}
