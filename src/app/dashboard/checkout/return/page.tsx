import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutResult } from "@/components/checkout/checkout-result";
import { Card } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Payment", robots: { index: false } };

/** Where the provider sends buyers who checked out from the dashboard. */
export default function DashboardCheckoutReturnPage(props: PageProps<"/dashboard/checkout/return">) {
  return (
    <div className="flex justify-center py-12">
      <Card className="w-full max-w-lg">
        <Suspense fallback={<p className="text-muted-foreground">Confirming your payment…</p>}>
          <CheckoutResult searchParams={props.searchParams} area="dashboard" />
        </Suspense>
      </Card>
    </div>
  );
}
