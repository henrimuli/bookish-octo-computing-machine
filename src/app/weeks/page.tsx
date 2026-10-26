import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Card, Container, Heading } from "@/components/ui/primitives";
import { weekArchive } from "@/lib/board/queries";
import { formatWeekLabel, formatWeekRange } from "@/lib/weeks";

export const metadata: Metadata = {
  title: "All weeks",
  description: "Every week of debuts on DebutYard.",
};

export default function WeeksPage() {
  return (
    <Container className="max-w-3xl py-12">
      <Heading>All weeks</Heading>
      <Suspense fallback={<p className="mt-6 text-muted-foreground">Loading…</p>}>
        <Archive />
      </Suspense>
    </Container>
  );
}

async function Archive() {
  await connection();
  const weeks = await weekArchive(104);
  if (weeks.length === 0) return <p className="mt-6 text-muted-foreground">The first week of debuts is coming up.</p>;
  return (
    <ul className="mt-8 grid gap-3 sm:grid-cols-2">
      {weeks.map((w) => (
        <li key={w.key}>
          <Link href={`/week/${w.key}`}>
            <Card className="p-4 transition-colors hover:border-foreground/20">
              <p className="font-medium">{formatWeekLabel(w.key)}</p>
              <p className="text-sm text-muted-foreground">
                {formatWeekRange(w.key)} · {w.count} debut{w.count === 1 ? "" : "s"}
              </p>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}
