"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { nextDuelAction, pickWinnerAction } from "@/app/(site)/vote/actions";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/primitives";
import type { DuelProduct } from "@/lib/board/duels";
import { ProductLogo } from "./product-logo";

export function Duel({ initial, signedIn }: { initial: [DuelProduct, DuelProduct] | null; signedIn: boolean }) {
  const router = useRouter();
  const [pair, setPair] = useState(initial);
  const [seen, setSeen] = useState<string[]>(initial ? initial.map((p) => p.id) : []);
  const [picked, setPicked] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function advance(after: (string | null)[] = []) {
    start(async () => {
      const exclude = [...seen, ...after.filter((x): x is string => Boolean(x))];
      const next = await nextDuelAction(exclude);
      setPair(next);
      if (next) setSeen([...exclude, ...next.map((p) => p.id)]);
    });
  }

  function pick(winner: DuelProduct) {
    if (!signedIn) return router.push(`/sign-in?next=${encodeURIComponent("/vote")}`);
    setError(null);
    start(async () => {
      const res = await pickWinnerAction(winner.id);
      if (!res.ok) return setError(res.error);
      setPicked((n) => n + 1);
      const next = await nextDuelAction(seen);
      setPair(next);
      if (next) setSeen((s) => [...s, ...next.map((p) => p.id)]);
    });
  }

  if (!pair) {
    return (
      <Card className="text-center">
        <p className="font-medium">
          {picked > 0 ? `Thanks! You picked ${picked} winner${picked === 1 ? "" : "s"}.` : "You've seen them all."}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">Come back when new products debut on Monday.</p>
        <Link href="/" className="mt-4 inline-block text-sm text-primary hover:underline">
          See this week&apos;s board
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {pair.map((p) => (
          <Card key={p.id} className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <ProductLogo name={p.name} src={p.logoUrl} />
              <div className="min-w-0">
                <Link href={`/p/${p.slug}`} target="_blank" className="font-semibold hover:text-primary">
                  {p.name}
                </Link>
                <p className="text-sm text-muted-foreground">{p.tagline}</p>
              </div>
            </div>
            <p className="flex-1 text-sm">{p.description}</p>
            <div className="flex flex-wrap gap-1.5">
              {p.categories.slice(0, 3).map((c) => (
                <Badge key={c}>{c}</Badge>
              ))}
            </div>
            <Button onClick={() => pick(p)} disabled={pending}>
              {p.name} wins
            </Button>
          </Card>
        ))}
      </div>
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>{picked > 0 && `${picked} picked`}</span>
        <button type="button" onClick={() => advance()} disabled={pending} className="hover:text-foreground">
          Skip this pair →
        </button>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
