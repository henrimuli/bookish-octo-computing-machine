import type { Metadata } from "next";
import Link from "next/link";
import { eq, inArray } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { OpsRows } from "@/components/submissions/ops-rows";
import { OrderControls } from "@/components/submissions/order-controls";
import { Badge, Card, Container, Heading } from "@/components/ui/primitives";
import { db, schema } from "@/db";
import { requireStaff } from "@/lib/auth";
import { PACKAGES } from "@/lib/submissions/packages";
import { orderRows, summarizeOrder } from "@/lib/submissions/service";

export const metadata: Metadata = { title: "Submission order · Admin", robots: { index: false } };

export default function OrderOpsPage(props: PageProps<"/admin/submissions/[id]">) {
  return (
    <Container className="max-w-6xl py-10">
      <Link href="/admin/submissions" className="text-sm text-muted-foreground hover:text-foreground">
        ← All orders
      </Link>
      <Suspense fallback={<p className="mt-6 text-muted-foreground">Loading…</p>}>
        <Detail params={props.params} />
      </Suspense>
    </Container>
  );
}

async function Detail({ params }: Pick<PageProps<"/admin/submissions/[id]">, "params">) {
  await requireStaff();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const order = await db().query.submissionOrders.findFirst({ where: eq(schema.submissionOrders.id, id) });
  if (!order) notFound();
  const [rows, staff] = await Promise.all([
    orderRows(order.id),
    db()
      .select({ id: schema.user.id, name: schema.user.name })
      .from(schema.user)
      .where(inArray(schema.user.role, ["admin", "ops"])),
  ]);
  const s = summarizeOrder(
    order,
    rows.map((r) => r.s),
  );
  const kit: Array<[string, string | null]> = [
    ["Website", order.websiteUrl],
    ["Tagline (60)", order.tagline],
    ["Short (160)", order.shortDescription],
    ["Long (500)", order.longDescription],
    ["Categories", order.categories.join(", ")],
    ["Logo", order.logoUrl],
    ["Founder", order.founderName],
    ["Contact", order.contactEmail ?? order.email],
    ["Badges", order.badgePreference === "allow" ? "Allowed (up to 5)" : "None"],
    ["Client notes", order.clientNotes],
  ];

  return (
    <div className="mt-4 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Heading>{order.productName ?? order.email}</Heading>
        <Badge>{PACKAGES[order.package].label}</Badge>
        <Badge tone={order.status === "delivered" ? "success" : "default"}>{order.status.replace("_", " ")}</Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        {s.live} live ({s.dofollow} dofollow) · {s.inReview} in review · {s.needsAction} need the client · {s.scheduled}
        /{s.target} scheduled ·{" "}
        <a href={`/orders/${order.intakeToken}`} target="_blank" className="text-primary hover:underline">
          client view ↗
        </a>
      </p>
      <OrderControls
        orderId={order.id}
        assigneeId={order.assigneeId}
        staff={staff}
        canDeliver={order.status === "queued" || order.status === "in_progress"}
      />
      {order.status === "awaiting_intake" ? (
        <Card className="p-5 text-sm text-muted-foreground">
          Waiting for the client to fill in the intake form. They were emailed the link.
        </Card>
      ) : (
        <>
          <Card className="p-0">
            <details>
              <summary className="cursor-pointer px-5 py-3 font-medium">Product kit</summary>
              <dl className="divide-y divide-border border-t border-border text-sm">
                {kit.map(([k, v]) => (
                  <div key={k} className="grid gap-1 px-5 py-2 sm:grid-cols-[9rem_1fr]">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="break-words whitespace-pre-line">{v || "–"}</dd>
                  </div>
                ))}
              </dl>
            </details>
          </Card>
          <Card className="p-5">
            <OpsRows
              orderId={order.id}
              rows={rows.map(({ s: r, d }) => ({
                id: r.id,
                status: r.status,
                liveUrl: r.liveUrl,
                notes: r.notes,
                actionNeeded: r.actionNeeded,
                evidenceUrl: r.evidenceUrl,
                linkVerdict: r.linkVerdict,
                linkAnchor: r.linkAnchor,
                linkCheckedAt: r.linkCheckedAt,
                replaces: Boolean(r.replacesId),
                directory: {
                  name: d.name,
                  url: d.url,
                  submitUrl: d.submitUrl,
                  dr: d.dr,
                  badgeRequired: d.badgeRequired,
                  needsAccount: d.needsAccount,
                  instructions: d.instructions,
                },
              }))}
            />
          </Card>
        </>
      )}
    </div>
  );
}
