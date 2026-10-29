import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { PackageCards, ServiceNotes, ServiceSteps } from "@/components/submissions/packages-view";
import { Container, Heading } from "@/components/ui/primitives";

export const metadata: Metadata = {
  title: "Directory submission service",
  description:
    "We submit your product to 40–180 niche-matched directories by hand, verify every link ourselves, and show it all on a live dashboard. No account needed.",
  alternates: { canonical: "/submission-service" },
};

export default function SubmissionServicePage(props: PageProps<"/submission-service">) {
  return (
    <Container className="max-w-5xl py-12">
      <Heading>Get listed on 40–180 directories. Done for you.</Heading>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        We submit your product by hand to directories that fit it, then verify every link ourselves instead of handing
        you a spreadsheet of claims. Follow it live: each directory moves from queued to live on your dashboard.
      </p>
      <ServiceSteps />
      <Suspense fallback={<div className="mt-10 h-80 animate-pulse rounded-lg bg-muted/50" />}>
        <Packages searchParams={props.searchParams} />
      </Suspense>
      <ServiceNotes />
    </Container>
  );
}

async function Packages({ searchParams }: Pick<PageProps<"/submission-service">, "searchParams">) {
  await connection();
  const { product } = await searchParams;
  return <PackageCards product={typeof product === "string" ? product : undefined} />;
}
