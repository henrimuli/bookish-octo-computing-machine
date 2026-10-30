import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Heading } from "@/components/ui/primitives";
import { requireStaff } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { samples } from "./samples";

export const metadata: Metadata = { title: "Emails · Admin", robots: { index: false } };

export default function EmailsAdminPage(props: PageProps<"/admin/emails">) {
  return (
    <div className="mx-auto max-w-6xl">
      <Heading className="text-2xl sm:text-3xl">Emails</Heading>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Every email uses one template (<code>src/lib/email-template.ts</code>). These samples show each kind with sample
        data, as HTML and as the plain-text version sent alongside it.
      </p>
      <Suspense fallback={<p className="mt-8 text-muted-foreground">Loading…</p>}>
        <Body searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Body({ searchParams }: { searchParams: PageProps<"/admin/emails">["searchParams"] }) {
  await requireStaff();
  const q = await searchParams;
  const sample = samples.find((s) => s.id === q.email) ?? samples[0];
  const view = q.view === "text" ? "text" : "html";
  const email = sample.render();
  const href = (id: string, v: string) => `/admin/emails?email=${id}&view=${v}` as const;

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <nav aria-label="Sample emails" className="grid content-start gap-1">
        {samples.map((s) => (
          <Link
            key={s.id}
            href={href(s.id, view)}
            aria-current={s.id === sample.id ? "page" : undefined}
            className={cn(
              "rounded-md border border-transparent px-3 py-2 hover:bg-muted",
              s.id === sample.id && "border-border bg-card",
            )}
          >
            <span className="block text-sm font-medium">{s.name}</span>
            <span className="block text-xs text-muted-foreground">{s.audience}</span>
          </Link>
        ))}
      </nav>
      <section className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">
            <span className="text-muted-foreground">Subject: </span>
            <span className="font-medium">{email.subject}</span>
          </p>
          <div className="flex gap-1 rounded-md border border-border p-0.5 text-sm">
            {(["html", "text"] as const).map((v) => (
              <Link
                key={v}
                href={href(sample.id, v)}
                aria-current={v === view ? "page" : undefined}
                className={cn(
                  "rounded px-3 py-1",
                  v === view ? "bg-foreground text-background" : "text-muted-foreground",
                )}
              >
                {v === "html" ? "HTML" : "Plain text"}
              </Link>
            ))}
          </div>
        </div>
        {view === "html" ? (
          <iframe
            title={`${sample.name} preview`}
            srcDoc={email.html}
            sandbox=""
            className="mt-3 h-[900px] w-full rounded-lg border border-border bg-white"
          />
        ) : (
          <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-lg border border-border bg-card p-5 text-sm">
            {email.text}
          </pre>
        )}
      </section>
    </div>
  );
}
