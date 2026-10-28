import type { Metadata } from "next";
import { Suspense } from "react";
import { ButtonLink } from "@/components/ui/button";
import { Card, Container, Heading } from "@/components/ui/primitives";
import { eq } from "drizzle-orm";
import { site } from "@/config/site";
import { db, schema } from "@/db";
import { confirmPayment } from "@/lib/payments/service";
import { CheckoutBroadcast } from "../broadcast";

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
          <Result searchParams={props.searchParams} />
        </Suspense>
      </Card>
    </Container>
  );
}

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}

async function Result({ searchParams }: { searchParams: PageProps<"/checkout/return">["searchParams"] }) {
  const params = await searchParams;
  const provider = first(params.provider);

  if (first(params.subscription)) {
    return (
      <Message
        title="Subscription started"
        body="We'll email you as soon as the provider confirms it. This usually takes under a minute."
      />
    );
  }

  // Paystack sends ?reference=, PayPal sends ?token= (the PayPal order id).
  const ref =
    provider === "paystack" ? first(params.reference) : provider === "paypal" ? first(params.token) : undefined;
  if (!ref || (provider !== "paystack" && provider !== "paypal")) {
    return <Message title="Nothing to confirm" body="We couldn't find a payment to confirm." />;
  }

  let order = null;
  try {
    order = await confirmPayment(provider, ref);
  } catch (err) {
    console.error("checkout return: confirm failed", err);
  }

  const broadcast = order && (
    <CheckoutBroadcast
      orderId={order.id}
      status={order.status === "paid" ? "paid" : order.status === "pending" ? "pending" : "failed"}
    />
  );

  if (order?.status === "paid" && order.kind === "submission") {
    const sub = await db().query.submissionOrders.findFirst({ where: eq(schema.submissionOrders.orderId, order.id) });
    if (sub) {
      return (
        <div className="space-y-4">
          <Heading className="text-2xl sm:text-2xl">Payment received. One more step</Heading>
          <p className="text-muted-foreground">
            Tell us about your product so we can start submitting. It takes about five minutes. We&apos;ve also emailed
            this link to {order.email}.
          </p>
          <ButtonLink href={`/orders/${sub.intakeToken}`}>Add your product details</ButtonLink>
        </div>
      );
    }
  }
  if (order?.status === "paid" && order.kind === "launch") {
    return (
      <>
        {broadcast}
        <Message
          title="Payment received. Thank you!"
          body={`Your debut is booked and we've emailed a confirmation to ${order.email}. You can close this tab and head back to DebutYard.`}
          href="/dashboard"
          cta="Go to your dashboard"
        />
      </>
    );
  }
  if (order?.status === "paid") {
    return (
      <>
        {broadcast}
        <Message
          title="Payment received. Thank you!"
          body={`We've emailed a confirmation to ${order.email}. Order reference: ${order.id}.`}
        />
      </>
    );
  }
  if (order?.status === "failed") {
    return (
      <>
        {broadcast}
        <Message
          title="Payment didn't go through"
          body={order.failureReason ?? "Your payment was declined. You haven't been charged."}
          retry
        />
      </>
    );
  }
  return (
    <>
      {broadcast}
      <Message
        title="Payment processing"
        body={`We're waiting for confirmation from the payment provider. You'll get an email as soon as it arrives. If you have questions, write to ${site.supportEmail}.`}
      />
    </>
  );
}

function Message({
  title,
  body,
  retry,
  href,
  cta,
}: {
  title: string;
  body: string;
  retry?: boolean;
  href?: string;
  cta?: string;
}) {
  return (
    <div className="space-y-4">
      <Heading className="text-2xl sm:text-2xl">{title}</Heading>
      <p className="text-muted-foreground">{body}</p>
      <ButtonLink href={href ?? (retry ? "/dashboard" : "/")} variant={retry || href ? "primary" : "outline"}>
        {cta ?? (retry ? "Back to your dashboard" : "Back to DebutYard")}
      </ButtonLink>
    </div>
  );
}
