import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { Suspense } from "react";
import { Card, Container, Heading } from "@/components/ui/primitives";
import { db, schema } from "@/db";
import { requireStaff } from "@/lib/auth";
import { renderDigest } from "@/lib/newsletter/render";
import { buildDigest, subscriberCounts } from "@/lib/newsletter/service";
import { addWeeks, formatWeekLabel, weekKeyFor } from "@/lib/weeks";

export const metadata: Metadata = { title: "Newsletter · Admin", robots: { index: false } };

export default function NewsletterAdminPage() {
  return (
    <Container className="max-w-5xl py-10">
      <Heading>Newsletter</Heading>
      <Suspense fallback={<p className="mt-8 text-muted-foreground">Loading…</p>}>
        <Body />
      </Suspense>
    </Container>
  );
}

async function Body() {
  await requireStaff();
  // Preview the digest that goes out after the current week closes.
  const previewWeek = weekKeyFor(new Date());
  const [counts, issues, data] = await Promise.all([
    subscriberCounts(),
    db().select().from(schema.newsletterIssues).orderBy(desc(schema.newsletterIssues.weekKey)).limit(12),
    buildDigest(previewWeek),
  ]);
  const preview = renderDigest(data, "#unsubscribe");

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
        <h2 className="font-display text-xl font-semibold">Sent issues</h2>
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
