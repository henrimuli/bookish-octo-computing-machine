import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutBroadcast } from "@/app/(site)/checkout/broadcast";
import { ButtonLink } from "@/components/ui/button";
import { Card, Heading } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Checkout cancelled", robots: { index: false } };

/** Where the provider sends buyers who cancelled a checkout started from the dashboard. */
export default function DashboardCheckoutCancelledPage(props: PageProps<"/dashboard/checkout/cancelled">) {
  return (
    <div className="flex justify-center py-12">
      <Card className="w-full max-w-lg space-y-4">
        <Heading className="text-2xl sm:text-2xl">Checkout cancelled</Heading>
        <p className="text-muted-foreground">No payment was taken. You can pick a package again any time.</p>
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/dashboard/orders/new">See packages</ButtonLink>
          <ButtonLink href="/dashboard/orders" variant="outline">
            Submission orders
          </ButtonLink>
        </div>
        <Suspense>
          <Notify searchParams={props.searchParams} />
        </Suspense>
      </Card>
    </div>
  );
}

async function Notify({ searchParams }: { searchParams: PageProps<"/dashboard/checkout/cancelled">["searchParams"] }) {
  const { order } = await searchParams;
  return typeof order === "string" && /^[0-9a-f-]{36}$/.test(order) ? (
    <CheckoutBroadcast orderId={order} status="cancelled" />
  ) : null;
}
