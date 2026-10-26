import Link from "next/link";
import { SponsoredRow } from "@/components/ads/sponsored";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import type { AdItem } from "@/lib/ads/service";
import { getCurrentUser } from "@/lib/auth";
import { weekBoard } from "@/lib/board/queries";
import { ProductRow } from "./product-row";

/**
 * A week's ranked board. Request-time: reads the session for "voted" state.
 * `sponsor` is the rotating featured row, shown between #3 and #4.
 */
export async function WeekBoard({
  weekKey,
  emptyCta = true,
  sponsor,
}: {
  weekKey: string;
  emptyCta?: boolean;
  sponsor?: AdItem | null;
}) {
  const user = await getCurrentUser().catch(() => null);
  const items = await weekBoard(weekKey, user?.id ?? null);

  if (items.length === 0) {
    return (
      <Card className="text-center">
        <p className="font-medium">No debuts this week yet.</p>
        {emptyCta && (
          <>
            <p className="mt-1 text-sm text-muted-foreground">Be the first: debut your product and get the top spot.</p>
            <ButtonLink href="/submit" className="mt-4">
              Debut your product
            </ButtonLink>
          </>
        )}
      </Card>
    );
  }

  return (
    <ol className="space-y-3">
      {items.slice(0, 3).map((item) => (
        <ProductRow key={item.id} item={item} />
      ))}
      {/* Skip a sponsor that's already in the top 3 just above. */}
      {sponsor && !items.slice(0, 3).some((i) => i.slug === sponsor.slug) && <SponsoredRow ad={sponsor} />}
      {items.slice(3).map((item) => (
        <ProductRow key={item.id} item={item} />
      ))}
    </ol>
  );
}

export function BoardSkeleton() {
  return (
    <ol className="space-y-3" aria-hidden>
      {Array.from({ length: 5 }, (_, i) => (
        <li key={i} className="h-[88px] animate-pulse rounded-lg border border-border bg-muted/50" />
      ))}
    </ol>
  );
}

export function WeekNav({ prev, next }: { prev?: string; next?: string }) {
  return (
    <div className="flex justify-between text-sm">
      {prev ? (
        <Link href={`/week/${prev}`} className="text-muted-foreground hover:text-foreground">
          ← Previous week
        </Link>
      ) : (
        <span />
      )}
      {next && (
        <Link href={`/week/${next}`} className="text-muted-foreground hover:text-foreground">
          Next week →
        </Link>
      )}
    </div>
  );
}
