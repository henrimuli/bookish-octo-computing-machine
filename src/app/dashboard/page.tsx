import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BookingStatsTable } from "@/components/ads/booking-stats";
import { BadgePanel } from "@/components/badge-panel";
import { DrChart } from "@/components/metrics/dr-chart";
import { ProductLogo } from "@/components/board/product-logo";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, Container, Heading } from "@/components/ui/primitives";
import { env } from "@/env";
import { bookingsForUser } from "@/lib/ads/service";
import { PACKAGES } from "@/lib/submissions/packages";
import { ordersForUser } from "@/lib/submissions/service";
import { requireUser } from "@/lib/auth";
import { can } from "@/lib/billing/entitlements";
import { drEnabled, drHistory } from "@/lib/metrics/service";
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
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/dashboard/tracker" variant="outline">
            Directory tracker
          </ButtonLink>
          <ButtonLink href="/dashboard/links" variant="outline">
            Link Monitor
          </ButtonLink>
          <ButtonLink href="/dashboard/billing" variant="outline">
            Billing
          </ButtonLink>
          <ButtonLink href="/dashboard/affiliate" variant="outline">
            Affiliate
          </ButtonLink>
          <ButtonLink href="/dashboard/api" variant="outline">
            API &amp; agents
          </ButtonLink>
          <ButtonLink href="/submit">Debut a product</ButtonLink>
        </div>
      </div>
      <Suspense fallback={<p className="mt-8 text-muted-foreground">Loading…</p>}>
        <Products searchParams={props.searchParams} />
        <DomainRating />
        <SubmissionOrders />
        <Sponsorships />
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

async function Sponsorships() {
  const user = await requireUser("/dashboard");
  const rows = await bookingsForUser(user.id);
  return (
    <section className="mt-14">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-display text-2xl font-bold">Your sponsorships</h2>
        <ButtonLink href="/advertise#book" variant="outline" size="sm">
          Book a slot
        </ButtonLink>
      </div>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          Featured slots on the leaderboard, homepage, categories and newsletter, with click stats here.
        </p>
      ) : (
        <div className="mt-4">
          <BookingStatsTable rows={rows} />
        </div>
      )}
    </section>
  );
}

/** Maker Pro: DR over time for each of the maker's product domains. */
async function DomainRating() {
  const user = await requireUser("/dashboard");
  if (!drEnabled() || !(await can(user.id, "dr_tracking"))) return null;
  const domains = (await dashboardProducts(user.id))
    .map((i) => i.product.domain)
    .filter((d, i, all): d is string => !!d && all.indexOf(d) === i);
  const histories = await Promise.all(domains.map(async (d) => ({ domain: d, points: await drHistory(d) })));
  return (
    <section className="mt-14">
      <h2 className="font-display text-2xl font-bold">Domain Rating</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Measured weekly. We email you if it drops by 5 points or more.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {histories.map((h) => (
          <Card key={h.domain} className="p-5">
            <p className="mb-2 text-sm font-medium">{h.domain}</p>
            {h.points.length ? (
              <DrChart points={h.points} since="first check" />
            ) : (
              <p className="text-sm text-muted-foreground">First reading within a day.</p>
            )}
          </Card>
        ))}
      </div>
    </section>
  );
}

async function SubmissionOrders() {
  const user = await requireUser("/dashboard");
  const orders = await ordersForUser(user.id, user.email);
  if (orders.length === 0) return null;
  return (
    <section className="mt-14">
      <h2 className="font-display text-2xl font-bold">Directory submission orders</h2>
      <ul className="mt-4 space-y-2">
        {orders.map(({ o, live, total }) => (
          <li key={o.id}>
            <Link
              href={`/orders/${o.intakeToken}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-4 hover:border-primary/50"
            >
              <span className="font-medium">{o.productName ?? "Waiting for your product details"}</span>
              <span className="text-sm text-muted-foreground">
                {PACKAGES[o.package].label} ·{" "}
                {o.status === "awaiting_intake"
                  ? "Add your details →"
                  : `${live}/${total} live · ${o.status.replace("_", " ")}`}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
