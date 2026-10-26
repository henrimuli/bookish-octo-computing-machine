import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/primitives";
import { getCurrentUser } from "@/lib/auth";
import { weekBoard } from "@/lib/board/queries";
import { ProductRow } from "./product-row";

/** A week's ranked board. Request-time: reads the session for "voted" state. */
export async function WeekBoard({ weekKey, emptyCta = true }: { weekKey: string; emptyCta?: boolean }) {
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
      {items.map((item) => (
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
