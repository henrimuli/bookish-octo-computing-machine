import Link from "next/link";
import { formatWeekLabel } from "@/lib/weeks";
import { ProductLogo } from "./product-logo";

export type SimpleItem = {
  slug: string;
  name: string;
  tagline: string;
  logo_url: string | null;
  launch_week_key: string;
  votes: number;
};

/** Read-only product list for category and builder pages. */
export function SimpleList({ items }: { items: SimpleItem[] }) {
  return (
    <ul className="space-y-3">
      {items.map((p) => (
        <li key={p.slug} className="flex items-center gap-4 rounded-lg border border-border bg-card p-4">
          <ProductLogo name={p.name} src={p.logo_url} />
          <div className="min-w-0 flex-1">
            <Link href={`/p/${p.slug}`} className="font-semibold hover:text-primary">
              {p.name}
            </Link>
            <p className="truncate text-sm text-muted-foreground">{p.tagline}</p>
            <p className="mt-1 text-xs text-muted-foreground">Debuted {formatWeekLabel(p.launch_week_key)}</p>
          </div>
          <span className="text-sm font-semibold text-muted-foreground">▲ {p.votes}</span>
        </li>
      ))}
    </ul>
  );
}
