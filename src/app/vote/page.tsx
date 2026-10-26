import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Duel } from "@/components/board/duel";
import { Container, Heading } from "@/components/ui/primitives";
import { getCurrentUser } from "@/lib/auth";
import { duelPair } from "@/lib/board/duels";

export const metadata: Metadata = {
  title: "Pick a winner",
  description: "Two new products, side by side. Pick the better one; every pick is a vote on this week's board.",
};

export default function VotePage() {
  return (
    <Container className="max-w-4xl py-12">
      <Heading>Pick a winner</Heading>
      <p className="mt-2 text-muted-foreground">
        Two of this week&apos;s debuts, side by side. Your pick counts as a vote on the weekly board.
      </p>
      <div className="mt-8">
        <Suspense fallback={<div className="h-72 animate-pulse rounded-lg bg-muted/50" />}>
          <Start />
        </Suspense>
      </div>
    </Container>
  );
}

async function Start() {
  await connection();
  const user = await getCurrentUser().catch(() => null);
  const pair = await duelPair(user?.id ?? null);
  return <Duel initial={pair} signedIn={Boolean(user)} />;
}
