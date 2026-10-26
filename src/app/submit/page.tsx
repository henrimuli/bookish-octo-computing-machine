import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductForm } from "@/components/product-form";
import { Card, Container, Heading } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth";
import { listCategories, uploadsEnabled } from "@/lib/products/queries";

export const metadata: Metadata = { title: "Debut your product", robots: { index: false } };

export default function SubmitPage() {
  return (
    <Container className="max-w-3xl py-12">
      <Heading>Debut your product</Heading>
      <p className="mt-2 text-muted-foreground">
        Paste your URL and we&apos;ll fill in what we can. You&apos;ll pick a free or paid debut on the next step.
      </p>
      <Card className="mt-8">
        <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
          <NewProduct />
        </Suspense>
      </Card>
    </Container>
  );
}

async function NewProduct() {
  await requireUser("/submit");
  const categories = await listCategories();
  return <ProductForm categories={categories} uploadsEnabled={uploadsEnabled()} />;
}
