import Link from "next/link";
import { Badge } from "@/components/ui/primitives";
import type { FeaturedItem } from "@/lib/board/featured";
import { ProductLogo } from "./product-logo";

/** Spotlight hero (max 3) plus the paid featured rail. Clearly labelled as featured. */
export function FeaturedRail({ items }: { items: FeaturedItem[] }) {
  if (items.length === 0) return null;
  const heroes = items.filter((i) => i.hero).slice(0, 3);
  const rail = items.filter((i) => !heroes.includes(i)).slice(0, 6);

  return (
    <section aria-label="Featured" className="mb-8 space-y-3">
      {heroes.map((h) => (
        <Link
          key={h.slug}
          href={`/p/${h.slug}`}
          className="flex items-center gap-4 rounded-lg border border-accent bg-accent/10 p-5 transition-colors hover:bg-accent/20"
        >
          <ProductLogo name={h.name} src={h.logoUrl} className="size-14" />
          <div className="min-w-0 flex-1">
            <Badge tone="accent">Spotlight</Badge>
            <p className="mt-1 font-display text-lg font-semibold">{h.name}</p>
            <p className="truncate text-sm text-muted-foreground">{h.tagline}</p>
          </div>
        </Link>
      ))}
      {rail.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Featured</p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {rail.map((f) => (
              <li key={f.slug}>
                <Link
                  href={`/p/${f.slug}`}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-foreground/20"
                >
                  <ProductLogo name={f.name} src={f.logoUrl} className="size-10" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{f.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{f.tagline}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
