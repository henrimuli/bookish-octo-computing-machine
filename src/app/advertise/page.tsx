import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { connection } from "next/server";
import { Suspense } from "react";
import { BookingForm } from "@/components/ads/booking-form";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Card, Container, Heading } from "@/components/ui/primitives";
import { db, schema } from "@/db";
import { availability, extraWeeksFor } from "@/lib/ads/service";
import { CPC_TARGET_CENTS, MAX_EXTENSIONS, PLACEMENTS } from "@/lib/ads/placements";
import { getCurrentUser } from "@/lib/auth";
import { categoriesWithCounts } from "@/lib/board/queries";
import { enabledProviders } from "@/lib/payments";
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
  const user = await getCurrentUser();
  if (!user) {
    return (
      <Card className="mt-6 text-center">
        <p className="font-medium">Sign in to see the calendar and book.</p>
        <ButtonLink href={`/sign-in?next=${encodeURIComponent("/advertise#book")}`} className="mt-4">
          Sign in
        </ButtonLink>
      </Card>
    );
  }
  const [products, categories, initialWeeks] = await Promise.all([
    db()
      .select({ id: schema.products.id, name: schema.products.name })
      .from(schema.products)
      .where(and(eq(schema.products.createdBy, user.id), eq(schema.products.status, "approved")))
      .orderBy(schema.products.name),
    categoriesWithCounts(),
    extraWeeksFor(user.id).then((extra) => availability("leaderboard", null, new Date(), extra)),
  ]);
  if (products.length === 0) {
    return (
      <Card className="mt-6 text-center">
        <p className="font-medium">Sponsors promote an approved DebutYard listing.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Submit your product first; you can book as soon as it&apos;s approved.
        </p>
        <ButtonLink href="/submit" className="mt-4">
          Submit your product
        </ButtonLink>
      </Card>
    );
  }
  return (
    <Card className="mt-6 p-6">
      <BookingForm
        products={products}
        categories={categories.map((c) => ({ slug: c.slug, name: c.name }))}
        providers={enabledProviders()}
        initialWeeks={initialWeeks}
      />
    </Card>
  );
}
