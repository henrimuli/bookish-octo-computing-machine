import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { OrderView } from "@/components/submissions/order-view";
import { requireUser } from "@/lib/auth";
import { orderByIntakeToken } from "@/lib/submissions/service";

export const metadata: Metadata = { title: "Submission order", robots: { index: false, follow: false } };

/** The emailed order page (intake, then live tracking), inside the dashboard. */
export default function DashboardOrderPage(props: PageProps<"/dashboard/orders/[token]">) {
  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/dashboard/orders" className="text-sm text-muted-foreground hover:text-foreground">
        ← Submission orders
      </Link>
      <div className="mt-3">
        <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-muted/50" />}>
          <Order params={props.params} />
        </Suspense>
      </div>
    </div>
  );
}

async function Order({ params }: Pick<PageProps<"/dashboard/orders/[token]">, "params">) {
  const { token } = await params;
  const user = await requireUser(`/dashboard/orders/${token}`);
  // Only the buyer's own orders, matched the same way as the orders list.
  const order = await orderByIntakeToken(token);
  if (!order || (order.userId !== user.id && order.email.toLowerCase() !== user.email.toLowerCase())) notFound();
  return <OrderView token={token} />;
}
