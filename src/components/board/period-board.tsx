import Link from "next/link";
import { Card, Container, Heading } from "@/components/ui/primitives";
import { getCurrentUser } from "@/lib/auth";
import { boardForWeeks } from "@/lib/board/queries";
import { formatPeriodLabel, weeksInPeriod } from "@/lib/periods";
import { weekKeyFor } from "@/lib/weeks";
import { ProductRow } from "./product-row";

/** Every product that debuted in a month or year, ranked by its debut-week score. */
export async function PeriodBoard({ scope, periodKey }: { scope: "month" | "year"; periodKey: string }) {
  const current = weekKeyFor(new Date());
  const weeks = weeksInPeriod(periodKey).filter((w) => w <= current);
  const user = await getCurrentUser().catch(() => null);
  const items = (await boardForWeeks(weeks, user?.id ?? null)).slice(0, 100);
  const label = formatPeriodLabel(scope, periodKey);
  const ongoing = weeks.length > 0 && weeks.length < weeksInPeriod(periodKey).length;

  return (
    <Container className="max-w-4xl py-12">
      <Heading>
        {scope === "month" ? "Debuts of" : "Best of"} {label}
      </Heading>
      <p className="mt-2 text-muted-foreground">
        Ranked by each product&apos;s score during its debut week.{" "}
        {ongoing ? "Still running: the ranking is final once the last week closes." : "Final ranking."}{" "}
        <Link href="/how-ranking-works" className="text-primary hover:underline">
          How ranking works
        </Link>
      </p>
      <div className="mt-8">
        {items.length ? (
          <ol className="space-y-3">
            {items.map((item) => (
              <ProductRow key={item.id} item={item} signedIn={Boolean(user)} />
            ))}
          </ol>
        ) : (
          <Card className="text-center text-muted-foreground">No debuts in {label} yet.</Card>
        )}
      </div>
    </Container>
  );
}
