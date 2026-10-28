import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PrintButton } from "@/components/print-button";
import { OrderReport } from "@/components/submissions/order-report";
import { Container, Heading } from "@/components/ui/primitives";
import { site } from "@/config/site";
import { orderByReportToken, orderRows, summarizeOrder } from "@/lib/submissions/service";

export const metadata: Metadata = { title: "Directory submission report", robots: { index: false, follow: false } };

export default function SharedReportPage(props: PageProps<"/r/[token]">) {
  return (
    <Container className="max-w-5xl py-12">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-muted/50" />}>
        <Report params={props.params} />
      </Suspense>
    </Container>
  );
}

/** Read-only, shareable: progress and live links only. */
async function Report({ params }: Pick<PageProps<"/r/[token]">, "params">) {
  const { token } = await params;
  const order = await orderByReportToken(token);
  if (!order || order.status === "awaiting_intake" || order.status === "cancelled") notFound();
  const rows = await orderRows(order.id);
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Directory submission report by {site.name}</p>
          <Heading>{order.productName}</Heading>
        </div>
        <PrintButton />
      </div>
      <OrderReport
        order={order}
        rows={rows}
        summary={summarizeOrder(
          order,
          rows.map((r) => r.s),
        )}
        shared
      />
      <p className="text-xs text-muted-foreground">
        Link checks are run by {site.name}: we fetch each live listing and look for a link to the product&apos;s site.
      </p>
    </div>
  );
}
