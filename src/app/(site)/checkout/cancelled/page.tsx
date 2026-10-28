import type { Metadata } from "next";
import { Suspense } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Card, Container, Heading } from "@/components/ui/primitives";
import { CheckoutBroadcast } from "../broadcast";

export const metadata: Metadata = { title: "Checkout cancelled", robots: { index: false } };

export default function CheckoutCancelledPage(props: PageProps<"/checkout/cancelled">) {
  return (
    <Container className="flex justify-center py-20">
      <Card className="w-full max-w-lg space-y-4">
        <Heading className="text-2xl sm:text-2xl">Checkout cancelled</Heading>
        <p className="text-muted-foreground">
          No payment was taken. You can close this tab, or pick up where you left off any time.
        </p>
        <ButtonLink href="/dashboard">Back to your dashboard</ButtonLink>
        <Suspense>
          <Notify searchParams={props.searchParams} />
        </Suspense>
      </Card>
    </Container>
  );
}

async function Notify({ searchParams }: { searchParams: PageProps<"/checkout/cancelled">["searchParams"] }) {
  const { order } = await searchParams;
  return typeof order === "string" && /^[0-9a-f-]{36}$/.test(order) ? (
    <CheckoutBroadcast orderId={order} status="cancelled" />
  ) : null;
}
