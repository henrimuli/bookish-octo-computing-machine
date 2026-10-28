import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { PlanPicker } from "@/components/plan-picker";
import { requireUser } from "@/lib/auth";
import { planChoices } from "@/lib/products/plan-choices";

export const metadata: Metadata = { title: "Choose your debut", robots: { index: false } };

export default function PlanPage(props: PageProps<"/dashboard/products/[id]/plan">) {
  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/dashboard/products" className="text-sm text-muted-foreground hover:text-foreground">
        ← Products
      </Link>
      <div className="mt-3">
        <PageHeader
          title="Choose your debut"
          description={
            <>
              Every paid debut is covered by our{" "}
              <Link href="/refund-policy" className="text-primary hover:underline">
                money-back guarantee
              </Link>
              .
            </>
          }
        />
      </div>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-muted/50" />}>
        <Plans params={props.params} />
      </Suspense>
    </div>
  );
}

async function Plans({ params }: { params: PageProps<"/dashboard/products/[id]/plan">["params"] }) {
  const { id } = await params;
  const user = await requireUser(`/dashboard/products/${id}/plan`);
  const choices = await planChoices(user.id, id);
  if (!choices) notFound();
  return <PlanPicker {...choices} />;
}
