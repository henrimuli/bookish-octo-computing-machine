import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BadgePanel } from "@/components/badge-panel";
import { ProductLogo } from "@/components/board/product-logo";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, Container, Heading } from "@/components/ui/primitives";
import { env } from "@/env";
import { requireUser } from "@/lib/auth";
import { dnsRecordValue } from "@/lib/badges/detect";
import { badgeSnippet } from "@/lib/badges/svg";
import { isFollowed } from "@/lib/board/links";
import { TIERS } from "@/lib/products/input";
import { dashboardProducts } from "@/lib/products/dashboard";
import { hasStarted } from "@/lib/products/service";
import { formatWeekLabel, formatWeekRange } from "@/lib/weeks";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false } };

const statusTone = {
  draft: "default",
  pending: "accent",
  approved: "success",
  rejected: "primary",
  archived: "default",
} as const;

const statusLabel = {
  draft: "Draft",
  pending: "In review",
  approved: "Approved",
  rejected: "Not approved",
  archived: "Archived",
} as const;

export default function DashboardPage(props: PageProps<"/dashboard">) {
  return (
    <Container className="max-w-5xl py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Heading>Your products</Heading>
        <ButtonLink href="/submit">Debut a product</ButtonLink>
      </div>
      <Suspense fallback={<p className="mt-8 text-muted-foreground">Loading…</p>}>
        <Products searchParams={props.searchParams} />
      </Suspense>
    </Container>
  );
}

async function Products({ searchParams }: { searchParams: PageProps<"/dashboard">["searchParams"] }) {
  const user = await requireUser("/dashboard");
  const params = await searchParams;
  const items = await dashboardProducts(user.id);
  const siteUrl = env().NEXT_PUBLIC_SITE_URL;

  return (
    <div className="mt-8 space-y-6">
      {params.submitted && (
        <p className="rounded-md bg-success/10 p-4 text-sm text-success">
          Submitted! We review new listings within 24 hours and will email you when it&apos;s scheduled.
        </p>
      )}
      {items.length === 0 && (
        <Card className="text-center">
          <p className="font-medium">You haven&apos;t submitted anything yet.</p>
          <ButtonLink href="/submit" className="mt-4">
            Debut your product
          </ButtonLink>
        </Card>
      )}
      {items.map(({ product: p, badge, stats, queueAhead }) => {
        const live = p.status === "approved" && hasStarted(p.launchWeekKey);
        const followed = isFollowed({ tier: p.tier, isWinner: p.isWinner, badgeStatus: badge?.status ?? "unverified" });
        const theme = (t: "light" | "dark") =>
          badgeSnippet({ siteUrl, slug: p.slug, theme: t, kind: p.isWinner ? "winner" : "featured" });
        return (
          <Card key={p.id} className="space-y-5">
            <div className="flex flex-wrap items-start gap-4">
              <ProductLogo name={p.name} src={p.logoUrl} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/p/${p.slug}`} className="font-display text-lg font-semibold hover:text-primary">
                    {p.name}
                  </Link>
                  <Badge tone={statusTone[p.status]}>{live ? "Live" : statusLabel[p.status]}</Badge>
                  <Badge>{TIERS[p.tier].label}</Badge>
                  {p.isWinner && <Badge tone="accent">Winner</Badge>}
                </div>
                <p className="truncate text-sm text-muted-foreground">{p.tagline}</p>
                <p className="mt-2 text-sm">
                  {p.status === "approved" && p.launchWeekKey ? (
                    <>
                      {live ? "Debuted" : "Debuts"} {formatWeekLabel(p.launchWeekKey)} (
                      {formatWeekRange(p.launchWeekKey)})
                      {!live && p.tier === "free" && queueAhead > 0 && ` · ${queueAhead} free debuts ahead of you`}
                    </>
                  ) : p.status === "pending" ? (
                    "Waiting for review (usually within 24 hours)."
                  ) : p.status === "rejected" ? (
                    <span className="text-danger">Not approved: {p.rejectionReason}</span>
                  ) : p.status === "draft" ? (
                    "Draft: choose a plan to submit it."
                  ) : null}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {["draft", "pending", "rejected"].includes(p.status) && (
                  <ButtonLink href={`/submit/${p.id}`} size="sm" variant="outline">
                    Edit
                  </ButtonLink>
                )}
                {p.tier !== "spotlight" && !live && p.status !== "archived" && (
                  <ButtonLink href={`/submit/${p.id}/plan`} size="sm">
                    {p.status === "draft" ? "Choose plan" : "Upgrade"}
                  </ButtonLink>
                )}
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              {[
                ["Votes", stats.votes],
                ["Comments", stats.comments],
                ["Views (30d)", stats.views_30d],
                ["Clicks to site (30d)", stats.clicks_30d],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md bg-muted p-3">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="font-display text-xl font-semibold">{value}</dd>
                </div>
              ))}
            </dl>

            {p.status !== "rejected" && p.status !== "archived" && badge && (
              <details open={p.tier === "free" && !followed} className="rounded-md border border-border p-4">
                <summary className="cursor-pointer text-sm font-medium">
                  Badge and link status:{" "}
                  <span className={followed ? "text-success" : "text-danger"}>
                    {followed ? "followed (dofollow)" : "nofollow until the badge is verified"}
                  </span>
                  {badge.status === "grace" && badge.graceUntil && (
                    <span className="text-danger">
                      {" "}
                      · badge missing, grace until {badge.graceUntil.toUTCString().slice(0, 16)}
                    </span>
                  )}
                </summary>
                <div className="mt-4">
                  <BadgePanel
                    productId={p.id}
                    required={p.tier === "free" && !p.isWinner}
                    snippets={{ light: theme("light"), dark: theme("dark") }}
                    previewUrls={{
                      light: `/badge/${p.slug}?theme=light${p.isWinner ? "&kind=winner" : ""}`,
                      dark: `/badge/${p.slug}?theme=dark${p.isWinner ? "&kind=winner" : ""}`,
                    }}
                    dnsHost={p.domain}
                    dnsValue={dnsRecordValue(badge.dnsToken)}
                  />
                </div>
              </details>
            )}
          </Card>
        );
      })}
    </div>
  );
}
