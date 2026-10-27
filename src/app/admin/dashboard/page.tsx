import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge, Card, Container, Heading } from "@/components/ui/primitives";
import { env } from "@/env";
import { adminOverview, cronStatus } from "@/lib/admin/overview";
import { setupChecklist } from "@/lib/admin/setup";
import { requireStaff } from "@/lib/auth";
import { formatUsd } from "@/lib/payments/skus";

export const metadata: Metadata = { title: "Dashboard · Admin", robots: { index: false } };

const dateTime = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
});

function ago(d: Date, now: number): string {
  const h = Math.floor((now - d.getTime()) / 3_600_000);
  if (h < 1) return "under an hour ago";
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)} days ago`;
}

const SECTIONS = [
  { href: "/admin/review", label: "Review queue", note: "Approve or reject listings" },
  { href: "/admin/submissions", label: "Submissions", note: "Done-for-you orders" },
  { href: "/admin/directories", label: "Directories", note: "Directory database and audit" },
  { href: "/admin/ads", label: "Ads", note: "Featured slot inventory" },
  { href: "/admin/blog", label: "Blog", note: "Posts and recap drafts" },
  { href: "/admin/newsletter", label: "Newsletter", note: "Subscribers and issues" },
  { href: "/admin/affiliates", label: "Affiliates", note: "Referrals and payouts" },
  { href: "/admin/users", label: "Admin users", note: "Who can open admin" },
];

export default function AdminDashboardPage() {
  return (
    <Container className="max-w-5xl py-10">
      <Heading>Dashboard</Heading>
      <Suspense fallback={<p className="mt-8 text-muted-foreground">Loading…</p>}>
        <Body />
      </Suspense>
    </Container>
  );
}

async function Body() {
  const me = await requireStaff("/admin/dashboard");
  const now = new Date();
  const [o, crons] = await Promise.all([adminOverview(now), cronStatus(now)]);
  const setup = setupChecklist(env());
  const missingRequired = setup.filter((s) => s.required && !s.ok);
  const t = now.getTime();

  const attention: Array<{ text: string; href?: string; tone: "danger" | "warn" }> = [];
  for (const s of missingRequired) attention.push({ text: `${s.label} isn't configured (${s.hint}).`, tone: "danger" });
  for (const c of crons) {
    if (c.stale) {
      attention.push({
        text: c.lastStartedAt
          ? `The ${c.job} cron last ran ${ago(c.lastStartedAt, t)}.`
          : `The ${c.job} cron hasn't run yet (check CRON_SECRET and vercel.json).`,
        tone: "danger",
      });
    }
    if (c.failed.length) {
      attention.push({
        text: `Last ${c.job} cron run failed: ${c.failed.join(", ")}. See the Vercel logs.`,
        tone: "danger",
      });
    }
  }
  if (o.review.pending) {
    attention.push({
      text: `${o.review.pending} listing${o.review.pending === 1 ? "" : "s"} waiting for review${o.review.oldest ? `, oldest ${ago(o.review.oldest, t)}` : ""}.`,
      href: "/admin/review",
      tone: "warn",
    });
  }
  const queued = (o.submissionOrders.queued ?? 0) + (o.submissionOrders.in_progress ?? 0);
  if (queued) {
    attention.push({
      text: `${queued} submission order${queued === 1 ? "" : "s"} to work on.`,
      href: "/admin/submissions",
      tone: "warn",
    });
  }
  if (o.stuckCheckouts) {
    attention.push({
      text: `${o.stuckCheckouts} checkout${o.stuckCheckouts === 1 ? "" : "s"} pending for over an hour this week (abandoned, or a missed webhook; the cron re-checks them).`,
      tone: "warn",
    });
  }
  if (o.affiliateOwedCents) {
    attention.push({
      text: `${formatUsd(o.affiliateOwedCents)} in approved affiliate commission to pay out.`,
      href: "/admin/affiliates",
      tone: "warn",
    });
  }

  const change = o.revenue.prev30Cents
    ? Math.round(((o.revenue.last30Cents - o.revenue.prev30Cents) / o.revenue.prev30Cents) * 100)
    : null;
  const tiles = [
    {
      label: "Revenue, 30 days",
      value: formatUsd(o.revenue.last30Cents),
      note:
        change === null
          ? `${formatUsd(o.revenue.allTimeCents)} all time`
          : `${change >= 0 ? "+" : ""}${change}% vs previous 30`,
    },
    {
      label: "Paid orders, 30 days",
      value: String(o.revenue.paidOrders30),
      note: `${formatUsd(o.revenue.refunds30Cents)} refunded`,
    },
    { label: "Users", value: String(o.users.total), note: `${o.users.new7} new this week` },
    { label: "Newsletter", value: String(o.subscribers), note: "active subscribers" },
    { label: "Subscriptions", value: String(o.subscriptions.reduce((n, s) => n + s.n, 0)), note: "active or past due" },
    { label: "Tracked links", value: String(o.links.active), note: `${o.links.problems} with problems` },
  ];

  return (
    <div className="mt-6 space-y-8">
      <p className="text-sm text-muted-foreground">
        Signed in as {me.email} <Badge className="ml-1">{me.staffRole}</Badge>
      </p>

      <section>
        <h2 className="font-display text-xl font-semibold">Needs attention</h2>
        {attention.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nothing right now.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {attention.map((a, i) => (
              <li
                key={i}
                className={`rounded-lg border px-4 py-3 text-sm ${a.tone === "danger" ? "border-danger/40 bg-danger/5" : "border-border bg-card"}`}
              >
                {a.href ? (
                  <Link href={a.href} className="hover:underline">
                    {a.text} →
                  </Link>
                ) : (
                  a.text
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((tile) => (
          <Card key={tile.label} className="p-5">
            <p className="text-sm text-muted-foreground">{tile.label}</p>
            <p className="mt-1 font-display text-3xl font-bold">{tile.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{tile.note}</p>
          </Card>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-medium">Revenue by product, 30 days</h2>
          {o.revenue.byKind.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No paid orders yet.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {o.revenue.byKind.map((k) => (
                <li key={k.kind} className="flex justify-between gap-2">
                  <span className="capitalize">{k.kind}</span>
                  <span className="text-muted-foreground">
                    {k.n} · <span className="text-foreground">{formatUsd(k.cents)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="p-5">
          <h2 className="font-medium">Submission orders</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {(["awaiting_intake", "queued", "in_progress", "delivered"] as const).map((s) => (
              <li key={s} className="flex justify-between gap-2">
                <span>{s.replace("_", " ").replace(/^\w/, (c) => c.toUpperCase())}</span>
                <span>{o.submissionOrders[s] ?? 0}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">
            {o.activeAds} active featured slot{o.activeAds === 1 ? "" : "s"} ·{" "}
            {o.subscriptions.map((s) => `${s.sku} ${s.n}`).join(", ") || "no subscriptions"}
          </p>
        </Card>
      </section>

      <section>
        <h2 className="font-display text-xl font-semibold">Recent orders</h2>
        {o.recentOrders.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No orders yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-lg border border-border text-sm">
            {o.recentOrders.map((r) => (
              <li key={r.id} className="grid gap-1 px-4 py-3 sm:grid-cols-[1fr_auto_auto] sm:items-center sm:gap-4">
                <span className="min-w-0 break-all">{r.email}</span>
                <span className="text-muted-foreground">
                  <span className="capitalize">{r.kind}</span> · {r.provider} · {dateTime.format(r.createdAt)} UTC
                </span>
                <span className="flex items-center gap-2 sm:justify-end">
                  {formatUsd(r.amountCents)}
                  <Badge tone={r.status === "paid" ? "success" : "default"}>{r.status.replace("_", " ")}</Badge>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-medium">Scheduled jobs</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {crons.map((c) => (
              <li key={c.job} className="flex flex-wrap justify-between gap-2">
                <span className="capitalize">{c.job}</span>
                <span className={c.stale || c.failed.length ? "text-danger" : "text-muted-foreground"}>
                  {c.lastStartedAt ? `${ago(c.lastStartedAt, t)}` : "never run"}
                  {c.failed.length ? ` · ${c.failed.length} failed` : c.lastFinishedAt ? " · ok" : ""}
                </span>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="p-5">
          <h2 className="font-medium">Setup</h2>
          <ul className="mt-3 grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
            {setup.map((s) => (
              <li key={s.label} className="flex items-center gap-2" title={s.hint}>
                <span
                  aria-hidden
                  className={s.ok ? "text-primary" : s.required ? "text-danger" : "text-muted-foreground"}
                >
                  {s.ok ? "✓" : "○"}
                </span>
                <span className={s.ok ? "" : "text-muted-foreground"}>
                  {s.label}
                  {!s.ok && !s.required ? " (optional)" : ""}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <section>
        <h2 className="font-display text-xl font-semibold">Sections</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {SECTIONS.map((s) => (
            <Link key={s.href} href={s.href} className="rounded-lg border border-border bg-card p-4 hover:bg-muted">
              <p className="font-medium">{s.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{s.note}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
