import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/button";
import { Card, Container, Heading } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Checkout cancelled", robots: { index: false } };

export default function CheckoutCancelledPage() {
  return (
    <Container className="flex justify-center py-20">
      <Card className="w-full max-w-lg space-y-4">
        <Heading className="text-2xl sm:text-2xl">Checkout cancelled</Heading>
        <p className="text-muted-foreground">No payment was taken. You can pick up where you left off any time.</p>
        <ButtonLink href="/pricing">Back to pricing</ButtonLink>
      </Card>
    </Container>
  );
}
