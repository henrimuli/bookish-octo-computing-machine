import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BadgePanel } from "@/components/badge-panel";
import { ProductLogo } from "@/components/board/product-logo";
import { ButtonLink } from "@/components/ui/button";
import { PageHeader } from "@/components/app-shell/page-header";
import { Badge, Card } from "@/components/ui/primitives";
import { env } from "@/env";
import { requireUser } from "@/lib/auth";
import { dnsRecordValue } from "@/lib/badges/detect";
import { badgeSnippet } from "@/lib/badges/svg";
import { isFollowed } from "@/lib/board/links";
import { TIERS } from "@/lib/products/input";
import { dashboardProducts } from "@/lib/products/dashboard";
import { hasStarted } from "@/lib/products/service";
import { statusLabel, statusTone } from "@/lib/products/status";
import { formatWeekLabel, formatWeekRange } from "@/lib/weeks";

export const metadata: Metadata = { title: "Products", robots: { index: false } };

export default function ProductsPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Products"
        description="Your listings, their stats, and the badge that keeps your link followed."
        actions={<ButtonLink href="/dashboard/products/new">Debut a product</ButtonLink>}
      />
      <Suspense fallback={<div className="h-64 animate-pulse rounded-lg bg-muted/50" />}>
        <Products />
      </Suspense>
    </div>
  );
}

async function Products() {
  const user = await requireUser("/dashboard/products");
  const items = await dashboardProducts(user.id);
  const siteUrl = env().NEXT_PUBLIC_SITE_URL;

  return (
    <div className="space-y-6">
      {items.length === 0 && (
        <Card className="text-center">
          <p className="font-medium">You haven&apos;t submitted anything yet.</p>
          <ButtonLink href="/dashboard/products/new" className="mt-4">
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
          <Card key={p.id} id={`product-${p.id}`} className="scroll-mt-20 space-y-5">
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
                  <ButtonLink href={`/dashboard/products/${p.id}`} size="sm" variant="outline">
                    Edit
                  </ButtonLink>
                )}
                {p.tier !== "spotlight" && !live && p.status !== "archived" && (
                  <ButtonLink href={`/dashboard/products/${p.id}/plan`} size="sm">
                    {p.status === "draft" ? "Choose plan" : "Upgrade"}
                  </ButtonLink>
                )}
              </div>
            </div>

            <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              {[
                ["Applause", stats.applause],
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
