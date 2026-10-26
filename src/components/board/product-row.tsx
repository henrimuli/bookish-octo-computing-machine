import Link from "next/link";
import { Badge } from "@/components/ui/primitives";
import type { BoardItem } from "@/lib/board/queries";
import { ProductLogo } from "./product-logo";
import { VoteButton } from "./vote-button";

const medals = ["🥇", "🥈", "🥉"];

export function ProductRow({ item, showRank = true }: { item: BoardItem; showRank?: boolean }) {
  return (
    <li className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-foreground/20">
      {showRank && (
        <span className="w-6 shrink-0 text-center font-display text-lg font-bold text-muted-foreground">
          {/* Medals only for placings that can win: awards need at least one vote. */}
          {item.rank <= 3 && item.votes > 0 ? medals[item.rank - 1] : item.rank}
        </span>
      )}
      <ProductLogo name={item.name} src={item.logoUrl} />
      <div className="min-w-0 flex-1">
        <Link href={`/p/${item.slug}`} className="font-semibold hover:text-primary">
          {item.name}
        </Link>
        <p className="truncate text-sm text-muted-foreground">{item.tagline}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
          {item.categories.slice(0, 3).map((c) => (
            <Link key={c.slug} href={`/category/${c.slug}`}>
              <Badge className="hover:text-foreground">{c.name}</Badge>
            </Link>
          ))}
          {item.comments > 0 && (
            <span>
              · {item.comments} comment{item.comments === 1 ? "" : "s"}
            </span>
          )}
          {item.tier !== "free" && <Badge tone="accent">Featured</Badge>}
        </div>
      </div>
      <VoteButton productId={item.id} voted={item.votedByMe} votes={item.votes} />
    </li>
  );
}
