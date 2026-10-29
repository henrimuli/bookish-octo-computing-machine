import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { BookingSection } from "@/components/ads/booking-section";
import { Badge, Card, Container, Heading } from "@/components/ui/primitives";
import { CPC_TARGET_CENTS, MAX_EXTENSIONS, PLACEMENTS } from "@/lib/ads/placements";
import { formatUsd, getSku } from "@/lib/payments/skus";

export const metadata: Metadata = {
  title: "Advertise",
  description:
    "Book a featured slot on DebutYard: leaderboard, homepage, category or newsletter. Capped inventory, click stats, and a cost-per-click guarantee.",
  alternates: { canonical: "/advertise" },
};

export default function AdvertisePage() {
  return (
    <Container className="max-w-5xl py-12">
      <Heading>Advertise on DebutYard</Heading>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Put your product in front of people who come here to find new tools. Every slot is capped, clearly labelled, and
        reported: you see impressions and clicks on your dashboard.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Object.values(PLACEMENTS).map((p) => (
          <Card key={p.id} className="flex flex-col p-5">
            <h2 className="font-display font-semibold">{p.label}</h2>
            <p className="mt-1 flex-1 text-sm text-muted-foreground">{p.description}</p>
            <p className="mt-4 text-sm">
              {Object.entries(p.skus)
                .map(
                  ([d, id]) =>
                    `${formatUsd(getSku(id!)!.amountCents)} / ${d === "month" ? "4 weeks" : p.id === "newsletter" ? "issue" : "week"}`,
                )
                .join(" · ")}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Badge>
                {p.cap} {p.id === "category" ? "per category" : "at a time"}
              </Badge>
              {p.cpcGuarantee && <Badge tone="success">CPC guarantee</Badge>}
            </div>
          </Card>
        ))}
      </div>

      <Card className="mt-8 p-5">
        <h2 className="font-display font-semibold">The CPC guarantee</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          On leaderboard, rail and category slots: if your cost per click is still above {formatUsd(CPC_TARGET_CENTS)}{" "}
          when your booking ends, the slot stays up for another week at no charge, up to {MAX_EXTENSIONS} extra weeks.
          Bot traffic and link previews don&apos;t count as clicks.
        </p>
      </Card>

      <section id="book" className="mt-14 scroll-mt-20">
        <h2 className="font-display text-2xl font-bold">Book a slot</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Sponsors promote a listing on DebutYard. Pick a placement and a week; unpaid bookings hold their slot for an
          hour.
        </p>
        <Suspense fallback={<Card className="mt-6 h-96 animate-pulse" />}>
          <Booking />
        </Suspense>
      </section>
    </Container>
  );
}

async function Booking() {
  await connection();
  return <BookingSection />;
}
