import type { Metadata } from "next";
import { Suspense } from "react";
import { OrderView } from "@/components/submissions/order-view";
import { Container } from "@/components/ui/primitives";

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

async function Order({ params }: Pick<PageProps<"/orders/[token]">, "params">) {
  const { token } = await params;
  return <OrderView token={token} />;
}
