import type { Metadata } from "next";
import { Suspense } from "react";
import { NewsletterTokenForm } from "@/components/newsletter-token-form";
import { Card, Container, Heading } from "@/components/ui/primitives";
import { unsubscribeAction } from "../actions";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false } };

export default function Page({ searchParams }: PageProps<"/newsletter/unsubscribe">) {
  return (
    <Container className="max-w-lg py-16">
      <Card className="space-y-4 p-8">
        <Heading className="text-2xl">Unsubscribe</Heading>
        <p className="text-muted-foreground">Stop receiving the weekly DebutYard digest.</p>
        <Suspense>
          <Form searchParams={searchParams} />
        </Suspense>
      </Card>
    </Container>
  );
}

async function Form({ searchParams }: Pick<PageProps<"/newsletter/unsubscribe">, "searchParams">) {
  const { token } = await searchParams;
  if (typeof token !== "string" || !token) return <p className="text-danger">This link is missing its token.</p>;
  return (
    <NewsletterTokenForm
      token={token}
      action={unsubscribeAction}
      label="Unsubscribe me"
      done="Done. You won't get the weekly digest any more."
      failed="We couldn't find that subscription. It may already be removed."
    />
  );
}
