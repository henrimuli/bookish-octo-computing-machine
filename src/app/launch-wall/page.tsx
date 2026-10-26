import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ProductLogo } from "@/components/board/product-logo";
import { ButtonLink } from "@/components/ui/button";
import { Card, Container, Heading } from "@/components/ui/primitives";
import { launchWall } from "@/lib/links/wall";

export const metadata: Metadata = {
  title: "Launch wall",
  description:
    "Makers and the live backlinks they've earned from launch directories, every one verified by DebutYard's own checks.",
  alternates: { canonical: "/launch-wall" },
};

export default function LaunchWallPage() {
  return (
    <Container className="max-w-5xl py-12">
      <Heading>Launch wall</Heading>
      <p className="mt-3 max-w-2xl text-muted-foreground">
        Makers who launched with DebutYard and the directory links they&apos;ve earned. Every link is one our crawler
        found live; nothing here is self-reported.
      </p>
      <Suspense fallback={<div className="mt-8 h-96 animate-pulse rounded-lg bg-muted/50" />}>
        <Wall />
      </Suspense>
    </Container>
  );
}

async function Wall() {
  const makers = await launchWall();
  if (makers.length === 0) {
    return (
      <Card className="mt-8 text-center">
        <p className="font-medium">No one on the wall yet.</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Track your directory submissions, then switch on the launch wall in Link Monitor.
        </p>
        <ButtonLink href="/dashboard/links" className="mt-4">
          Open Link Monitor
        </ButtonLink>
      </Card>
    );
  }
  return (
    <>
      <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {makers.map((m) => (
          <li key={m.userId}>
            <Link
              href={`/builders/${m.handle}`}
              className="flex h-full items-center gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50"
            >
              <ProductLogo name={m.name} src={m.image} className="size-12 shrink-0 rounded-full" />
              <div className="min-w-0">
                <p className="truncate font-medium">{m.name}</p>
                <p className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground tabular-nums">{m.dofollow}</span> dofollow ·{" "}
                  <span className="tabular-nums">{m.total}</span> verified link{m.total === 1 ? "" : "s"}
                </p>
                <p className="truncate text-xs text-muted-foreground">{m.domains.join(", ")}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-sm text-muted-foreground">
        Want to be on the wall?{" "}
        <Link href="/dashboard/links" className="text-primary hover:underline">
          Switch it on in Link Monitor
        </Link>
        .
      </p>
    </>
  );
}
