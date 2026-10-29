import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckoutResult } from "@/components/checkout/checkout-result";
import { Card, Container } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Payment", robots: { index: false } };

/**
 * Providers redirect here after checkout. We confirm with the provider
 * server-side (capturing PayPal orders) rather than trusting the redirect.
 */
export default function CheckoutReturnPage(props: PageProps<"/checkout/return">) {
  return (
    <Container className="flex justify-center py-20">
      <Card className="w-full max-w-lg">
        <Suspense fallback={<p className="text-muted-foreground">Confirming your payment…</p>}>
          <CheckoutResult searchParams={props.searchParams} />
        </Suspense>
      </Card>
    </Container>
  );
}
