import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Card, Container, Heading } from "@/components/ui/primitives";
import { categoriesWithCounts } from "@/lib/board/queries";

export const metadata: Metadata = { title: "Categories", description: "Browse products on DebutYard by category." };

export default function CategoriesPage() {
  return (
    <Container className="max-w-4xl py-12">
      <Heading>Categories</Heading>
      <Suspense fallback={<p className="mt-6 text-muted-foreground">Loading…</p>}>
        <List />
      </Suspense>
    </Container>
  );
}

async function List() {
  await connection();
  const categories = await categoriesWithCounts();
  return (
    <ul className="mt-8 grid gap-3 sm:grid-cols-3">
      {categories.map((c) => (
        <li key={c.slug}>
          <Link href={`/category/${c.slug}`}>
            <Card className="flex items-center justify-between p-4 transition-colors hover:border-foreground/20">
              <span className="font-medium">{c.name}</span>
              <span className="text-sm text-muted-foreground">{c.count}</span>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}
