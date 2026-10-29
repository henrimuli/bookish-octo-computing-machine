import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { PageHeader } from "@/components/app-shell/page-header";
import { PackageCards, ServiceSteps } from "@/components/submissions/packages-view";
import { ServiceDetails } from "@/components/submissions/service-pitch";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Submission packages", robots: { index: false } };

/** The submission service's packages, bought without leaving the dashboard. */
export default function NewOrderPage(props: PageProps<"/dashboard/orders/new">) {
  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/dashboard/orders" className="text-sm text-muted-foreground hover:text-foreground">
        ← Submission orders
      </Link>
      <div className="mt-3">
        <PageHeader
          title="Get listed on 40–180 directories"
          description="We submit your product by hand to directories that fit it, then verify every link ourselves. Follow it live from your submission orders."
        />
      </div>
      <ServiceSteps />
      <Suspense fallback={<div className="mt-10 h-80 animate-pulse rounded-lg bg-muted/50" />}>
        <Packages searchParams={props.searchParams} />
      </Suspense>
      <ServiceDetails compact />
    </div>
  );
}

async function Packages({ searchParams }: Pick<PageProps<"/dashboard/orders/new">, "searchParams">) {
  await connection();
  await requireUser("/dashboard/orders/new");
  const { product } = await searchParams;
  return <PackageCards product={typeof product === "string" ? product : undefined} returnTo="dashboard" />;
}
