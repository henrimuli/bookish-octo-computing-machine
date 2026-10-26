import Link from "next/link";
import { ProductLogo } from "@/components/board/product-logo";
import { Badge } from "@/components/ui/primitives";
import type { AdItem } from "@/lib/ads/service";
import { AdImpressions } from "./ad-impressions";

const REL = "sponsored noopener";

/** The rotating featured row between #3 and #4 on the board. */
export function SponsoredRow({ ad }: { ad: AdItem }) {
  return (
    <li className="flex min-w-0 items-center gap-3 rounded-lg border border-accent/60 bg-accent/5 p-4">
      <span className="w-6 shrink-0 text-center text-xs text-muted-foreground" aria-hidden>
        ★
      </span>
      <ProductLogo name={ad.name} src={ad.logoUrl} />
      <div className="min-w-0 flex-1">
        {ad.bookingId ? (
          <a href={ad.href} rel={REL} target="_blank" className="font-semibold hover:text-primary">
            {ad.name}
          </a>
        ) : (
          <Link href={ad.href} className="font-semibold hover:text-primary">
            {ad.name}
          </Link>
        )}
        <p className="truncate text-sm text-muted-foreground">{ad.tagline}</p>
        <div className="mt-1.5 flex items-center gap-2 text-xs">
          <Badge tone="accent">Featured</Badge>
          <Link href={`/p/${ad.slug}`} className="text-muted-foreground hover:text-foreground">
            Listing
          </Link>
        </div>
      </div>
      {ad.bookingId && <AdImpressions ids={[ad.bookingId]} />}
    </li>
  );
}

/** Full-width sponsor banner (homepage top, category pages). */
export function SponsorBanner({ ad, label = "Sponsor" }: { ad: AdItem; label?: string }) {
  return (
    <a
      href={ad.href}
      rel={REL}
      target="_blank"
      className="mb-6 flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/50"
    >
      <ProductLogo name={ad.name} src={ad.logoUrl} className="size-12" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="font-display font-semibold">{ad.name}</p>
        <p className="truncate text-sm text-muted-foreground">{ad.tagline}</p>
      </div>
      <span className="hidden text-sm font-medium text-primary sm:inline">Visit →</span>
      {ad.bookingId && <AdImpressions ids={[ad.bookingId]} />}
    </a>
  );
}
