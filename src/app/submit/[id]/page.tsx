import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ProductForm } from "@/components/product-form";
import { Card, Container, Heading } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth";
import { getEditableProduct, listCategories, uploadsEnabled } from "@/lib/products/queries";

export const metadata: Metadata = { title: "Edit listing", robots: { index: false } };

export default function EditProductPage(props: PageProps<"/submit/[id]">) {
  return (
    <Container className="max-w-3xl py-12">
      <Heading>Edit listing</Heading>
      <Card className="mt-8">
        <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
          <Edit params={props.params} />
        </Suspense>
      </Card>
    </Container>
  );
}

async function Edit({ params }: { params: PageProps<"/submit/[id]">["params"] }) {
  const { id } = await params;
  const user = await requireUser(`/submit/${id}`);
  const editable = /^[0-9a-f-]{36}$/.test(id) ? await getEditableProduct(id, user.id) : null;
  if (!editable) notFound();
  if (!["draft", "pending", "rejected"].includes(editable.product.status)) {
    return <p className="text-muted-foreground">This listing is approved. Email support if you need changes.</p>;
  }
  const categories = await listCategories();
  return (
    <ProductForm
      categories={categories}
      initial={editable.input}
      productId={editable.product.id}
      uploadsEnabled={uploadsEnabled()}
    />
  );
}
