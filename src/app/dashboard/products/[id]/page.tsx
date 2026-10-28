import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { ProductForm } from "@/components/product-form";
import { Card } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth";
import { getEditableProduct, listCategories, screenshotsEnabled, uploadsEnabled } from "@/lib/products/queries";

export const metadata: Metadata = { title: "Edit listing", robots: { index: false } };

export default function EditProductPage(props: PageProps<"/dashboard/products/[id]">) {
  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/dashboard/products" className="text-sm text-muted-foreground hover:text-foreground">
        ← Products
      </Link>
      <div className="mt-3">
        <PageHeader title="Edit listing" />
      </div>
      <Card>
        <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
          <Edit params={props.params} />
        </Suspense>
      </Card>
    </div>
  );
}

async function Edit({ params }: { params: PageProps<"/dashboard/products/[id]">["params"] }) {
  const { id } = await params;
  const user = await requireUser(`/dashboard/products/${id}`);
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
      screenshotsEnabled={screenshotsEnabled()}
    />
  );
}
