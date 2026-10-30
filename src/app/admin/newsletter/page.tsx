import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { Suspense } from "react";
import { MentionControls } from "@/components/admin/perk-controls";
import { ProductLogo } from "@/components/board/product-logo";
import { Badge, Card, Heading } from "@/components/ui/primitives";
import { db, schema } from "@/db";
import { requireStaff } from "@/lib/auth";
import { renderDigest } from "@/lib/newsletter/render";
import { buildDigest, engagementByIssue, subscriberCounts } from "@/lib/newsletter/service";
import { openMentions, pastMentions, PERK_LABELS, type PerkRow } from "@/lib/perks/service";
import { TIERS } from "@/lib/products/input";
import { addWeeks, formatWeekLabel, weekKeyFor } from "@/lib/weeks";

export const metadata: Metadata = { title: "Newsletter · Admin", robots: { index: false } };

export default function NewsletterAdminPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <Heading className="text-2xl sm:text-3xl">Newsletter</Heading>
      <Suspense fallback={<p className="mt-8 text-muted-foreground">Loading…</p>}>
        <Body />
      </Suspense>
    </div>
  );
}

async function Body() {
  await requireStaff();
  // Preview the digest that goes out after the current week closes.
  const previewWeek = weekKeyFor(new Date());
  const [counts, issues, data, mentions, past] = await Promise.all([
    subscriberCounts(),
    db().select().from(schema.newsletterIssues).orderBy(desc(schema.newsletterIssues.weekKey)).limit(12),
    buildDigest(previewWeek),
    openMentions(),
    pastMentions(),
  ]);
  const inNextIssue = new Set(data.perkTaskIds);
  const preview = renderDigest(data, "#unsubscribe");
  const engagement = await engagementByIssue(issues.map((i) => i.weekKey));
  const pct = (n: number, of: number) => (of > 0 ? ` (${Math.round((n / of) * 100)}%)` : "");

  return (
    <div className="mt-8 space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        {(["active", "pending", "unsubscribed"] as const).map((k) => (
          <Card key={k} className="p-5">
            <p className="text-sm capitalize text-muted-foreground">{k}</p>
            <p className="mt-1 font-display text-3xl font-bold">{counts[k]}</p>
          </Card>
        ))}
      </div>

      <section>
        <h2 className="font-display text-xl font-semibold">Paid mentions for the next issue</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Pro and Premium debuts get a line under Featured debuts; Spotlight gets the boxed top slot. They go out
          automatically, with the tagline unless you write a blurb. Skip one to leave it out.
        </p>
        {mentions.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">No paid mentions waiting.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
            {mentions.map((m) => (
              <li key={m.task.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row">
                <div className="flex min-w-0 flex-1 gap-3">
                  <ProductLogo name={m.name} src={m.logoUrl} className="size-10" />
                  <div className="min-w-0">
                    <a href={`/p/${m.slug}`} className="font-medium hover:text-primary">
                      {m.name}
                    </a>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge tone="primary">{TIERS[m.tier].label}</Badge>
                      <Badge>{PERK_LABELS[m.task.kind]}</Badge>
                      <MentionTarget row={m} included={inNextIssue.has(m.task.id)} />
                    </div>
                  </div>
                </div>
                <div className="sm:w-96">
                  <MentionControls taskId={m.task.id} blurb={m.task.blurb} tagline={m.tagline} />
                </div>
              </li>
            ))}
          </ul>
        )}
        {past.length > 0 && <MentionHistory rows={past} />}
      </section>

      <section>
        <h2 className="font-display text-xl font-semibold">Sent issues</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Unique opens and clicks from Resend webhooks. Opens are approximate: some mail apps load images for privacy.
        </p>
        {issues.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Nothing sent yet. The digest goes out automatically after each week closes.
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-border rounded-lg border border-border text-sm">
            {issues.map((i) => (
              <li key={i.weekKey} className="flex flex-wrap justify-between gap-2 px-4 py-3">
                <span className="font-medium">{formatWeekLabel(i.weekKey)}</span>
                <span className="text-muted-foreground">{i.subject}</span>
                <span className={i.error ? "text-danger" : "text-muted-foreground"}>
                  {i.sentAt ? `${i.recipients} sent` : i.error ? `failed: ${i.error}` : "sending…"}
                </span>
                {i.sentAt && (
                  <span className="w-full text-xs text-muted-foreground sm:w-auto">
                    {(() => {
                      const e = engagement.get(i.weekKey) ?? { opens: 0, clicks: 0 };
                      return `${e.opens} opened${pct(e.opens, i.recipients)} · ${e.clicks} clicked${pct(e.clicks, i.recipients)}`;
                    })()}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-display text-xl font-semibold">
          Next issue preview{" "}
          <span className="text-sm font-normal text-muted-foreground">
            (after {formatWeekLabel(previewWeek)} closes; {formatWeekLabel(addWeeks(previewWeek, 1))} debuts)
          </span>
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">Subject: {preview.subject}</p>
        <iframe
          title="Digest preview"
          srcDoc={preview.html}
          sandbox=""
          className="mt-3 h-[700px] w-full rounded-lg border border-border bg-white"
        />
      </section>
    </div>
  );
}

function MentionTarget({ row, included }: { row: PerkRow; included: boolean }) {
  if (included) return <Badge tone="success">In the next issue</Badge>;
  if (row.status !== "approved") return <Badge tone="accent">Waits for approval</Badge>;
  return <Badge>Issue after {formatWeekLabel(row.task.weekKey)}</Badge>;
}

/** Delivered and skipped mentions, grouped by the issue they went out in. */
function MentionHistory({ rows }: { rows: PerkRow[] }) {
  const delivered = new Map<string, PerkRow[]>();
  for (const r of rows.filter((r) => r.task.status === "done")) {
    delivered.set(r.task.weekKey, [...(delivered.get(r.task.weekKey) ?? []), r]);
  }
  const skipped = rows.filter((r) => r.task.status === "skipped");
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Past mentions</summary>
      <ul className="mt-2 space-y-1.5">
        {[...delivered].map(([week, list]) => (
          <li key={week}>
            <span className="font-medium">Delivered in the {formatWeekLabel(week)} issue:</span>{" "}
            {list.map((r) => `${r.name}${r.task.kind === "newsletter_top" ? " (top slot)" : ""}`).join(", ")}
          </li>
        ))}
        {skipped.map((r) => (
          <li key={r.task.id} className="text-muted-foreground">
            Skipped {r.name}: {r.task.skipReason}
          </li>
        ))}
      </ul>
    </details>
  );
}
