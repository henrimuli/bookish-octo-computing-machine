import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PrintButton } from "@/components/print-button";
import { IntakeForm } from "@/components/submissions/intake-form";
import { OrderReport } from "@/components/submissions/order-report";
import { ButtonLink } from "@/components/ui/button";
import { Card, Container, Heading } from "@/components/ui/primitives";
import { env } from "@/env";
import { listCategories } from "@/lib/products/queries";
import { PACKAGES } from "@/lib/submissions/packages";
import { guidedChecklist, orderByIntakeToken, orderRows, summarizeOrder } from "@/lib/submissions/service";

export const metadata: Metadata = { title: "Your submission order", robots: { index: false, follow: false } };

export default function OrderPage(props: PageProps<"/orders/[token]">) {
  return (
    <Container className="max-w-5xl py-12">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-muted/50" />}>
        <Order params={props.params} />
      </Suspense>
    </Container>
  );
}

/** The private order link: intake first, then the live tracking dashboard. */
async function Order({ params }: Pick<PageProps<"/orders/[token]">, "params">) {
  const { token } = await params;
  const order = await orderByIntakeToken(token);
  if (!order || order.status === "cancelled") notFound();
  const pkg = PACKAGES[order.package];

  if (order.status === "awaiting_intake") {
    return (
      <>
        <Heading>Tell us about your product</Heading>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          {pkg.label}: {pkg.count} directories. Directories show different lengths of description, so we ask for three.
          Submissions start within 48 hours of this form.
        </p>
        <Card className="mt-8 p-6">
          <IntakeForm
            token={token}
            categories={await listCategories()}
            initial={{
              productName: order.productName ?? "",
              websiteUrl: order.websiteUrl ?? "",
              tagline: order.tagline ?? "",
              shortDescription: order.shortDescription ?? "",
              longDescription: order.longDescription ?? "",
              categories: order.categories,
              logoUrl: order.logoUrl ?? "",
              founderName: order.founderName ?? "",
              contactEmail: order.contactEmail ?? order.email,
              clientNotes: order.clientNotes ?? "",
              badgePreference: order.badgePreference,
              allowAccounts: false,
            }}
          />
        </Card>
      </>
    );
  }

  const [rows, guided] = await Promise.all([orderRows(order.id), guidedChecklist()]);
  const summary = summarizeOrder(
    order,
    rows.map((r) => r.s),
  );
  const shareUrl = new URL(`/r/${order.reportToken}`, env().NEXT_PUBLIC_SITE_URL).toString();
  const needs = rows.filter((r) => r.s.status === "needs_action");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Heading>{order.productName}</Heading>
          <p className="mt-1 text-muted-foreground">
            Directory submissions, live. Every link is checked by us, not self-reported.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 print:hidden">
          <ButtonLink href={`/orders/${token}/export.csv`} variant="outline" size="sm">
            CSV
          </ButtonLink>
          <PrintButton />
        </div>
      </div>
      {needs.length > 0 && (
        <Card className="border-accent p-5">
          <p className="font-medium">We need something from you</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {needs.map(({ s, d }) => (
              <li key={s.id}>
                <strong>{d.name}</strong>: {s.actionNeeded ?? "Reply to our email about this directory."}
              </li>
            ))}
          </ul>
        </Card>
      )}
      <OrderReport order={order} rows={rows} summary={summary} />
      {guided.length > 0 && (
        <Card className="p-5 print:hidden">
          <p className="font-medium">Do these yourself (they need you personally)</p>
          <p className="mt-1 text-sm text-muted-foreground">
            These sites need your own account or vendor verification, so they aren&apos;t in your package count. Track
            them in the free{" "}
            <a href="/dashboard/tracker" className="text-primary hover:underline">
              directory tracker
            </a>
            .
          </p>
          <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            {guided.map((g) => (
              <li key={g.slug}>
                <a href={g.url} target="_blank" rel="noopener nofollow" className="hover:text-primary">
                  {g.name} ↗
                </a>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <Card className="p-5 text-sm print:hidden">
        <p className="font-medium">Share a read-only report</p>
        <p className="mt-1 text-muted-foreground">
          Anyone with this link sees progress and live links, but not notes or this page.
        </p>
        <code className="mt-2 block break-all rounded bg-muted p-2 text-xs">{shareUrl}</code>
      </Card>
    </div>
  );
}
