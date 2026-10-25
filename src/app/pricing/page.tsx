import type { Metadata } from "next";
import Link from "next/link";
import { BuyButton } from "@/components/buy-button";
import { Badge, Card, Container, Heading } from "@/components/ui/primitives";
import { enabledProviders, formatUsd, SKUS, type Sku } from "@/lib/payments";
import { isPurchasable } from "@/lib/payments/skus";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Debut for free, skip the queue, get featured, or have us submit your product to 40–180 directories.",
};

const sections: Array<{ id: string; title: string; blurb: string; filter: (s: Sku) => boolean }> = [
  {
    id: "launch",
    title: "Debut your product",
    blurb: "Free debuts wait in a visible queue and need our badge on your site. Paid debuts skip both.",
    filter: (s) => s.type === "one_time" && (s.kind === "launch" || s.kind === "relaunch"),
  },
  {
    id: "submissions",
    title: "Directory submissions, done for you",
    blurb: "We submit by hand, then verify every listing: live, dofollow, indexed. No account needed.",
    filter: (s) => s.type === "one_time" && s.kind === "submission",
  },
  {
    id: "featured",
    title: "Featured placements",
    blurb:
      "Capped slots with click reporting. If your cost per click isn't under $1 by the end, the slot stays up free until it is.",
    filter: (s) => s.type === "one_time" && s.kind === "featured",
  },
  {
    id: "plans",
    title: "Plans",
    blurb: "Monthly or yearly, cancel anytime.",
    filter: (s) => s.type === "recurring",
  },
];

export default function PricingPage() {
  const providers = enabledProviders();
  return (
    <Container className="py-16">
      <Heading>Pricing</Heading>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Prices in USD. Every paid debut is covered by our{" "}
        <Link href="/refund-policy" className="text-primary underline-offset-4 hover:underline">
          money-back guarantee
        </Link>
        : if we don&apos;t approve your listing, it isn&apos;t live within 48 hours, or the link isn&apos;t dofollow,
        you get a full refund.
      </p>

      <Card className="mt-10 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-lg font-semibold">Free debut</h2>
          <p className="text-sm text-muted-foreground">
            Join the weekly queue, add our badge to your site, and get a dofollow link while it stays. Top 3 each week
            keep the link for good.
          </p>
        </div>
        <Badge tone="success">$0</Badge>
      </Card>

      {sections.map((section) => (
        <section key={section.id} id={section.id} className="mt-14 scroll-mt-20">
          <h2 className="font-display text-2xl font-bold">{section.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{section.blurb}</p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SKUS.filter(section.filter).map((sku) => (
              <Card key={sku.id} className="flex flex-col">
                <h3 className="font-medium">{sku.name}</h3>
                <p className="mt-1 font-display text-3xl font-bold">
                  {formatUsd(sku.amountCents)}
                  {sku.type === "recurring" && (
                    <span className="text-base font-normal text-muted-foreground">
                      /{sku.interval === "monthly" ? "mo" : "yr"}
                    </span>
                  )}
                </p>
                <p className="mt-2 flex-1 text-sm text-muted-foreground">{sku.description}</p>
                {isPurchasable(sku) ? (
                  <BuyButton sku={sku.id} recurring={sku.type === "recurring"} providers={providers} className="mt-6" />
                ) : (
                  <Button className="mt-6" variant="outline" disabled>
                    Opening soon
                  </Button>
                )}
              </Card>
            ))}
          </div>
        </section>
      ))}
    </Container>
  );
}
