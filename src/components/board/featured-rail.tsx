import Link from "next/link";
import { AdImpressions } from "@/components/ads/ad-impressions";
import { Badge } from "@/components/ui/primitives";
import type { AdItem } from "@/lib/ads/service";
import type { FeaturedItem } from "@/lib/board/featured";
import type { ApplauseState } from "@/lib/board/queries";
import { ClapButton } from "./clap-button";
import { ProductLogo } from "./product-logo";

type RailCard = {
  key: string;
  href: string;
  external: boolean;
  name: string;
  tagline: string;
  logoUrl: string | null;
  clap?: ApplauseState;
};

/**
 * Spotlight hero (max 3) plus the featured rail: booked rail slots first, then
 * paid debut tiers, six cards at most. Clearly labelled as featured. Listings
 * carry a clap button (all-time applause), so they keep collecting applause for
 * as long as they're featured; booked ads don't.
 */
export function FeaturedRail({
  items,
  ads = [],
  applause = new Map(),
  signedIn,
}: {
  items: FeaturedItem[];
  ads?: AdItem[];
  /** Clap state by slug, from applauseForSlugs. */
  applause?: Map<string, ApplauseState>;
  signedIn?: boolean;
}) {
  if (items.length === 0 && ads.length === 0) return null;
  const heroes = items.filter((i) => i.hero).slice(0, 3);
  const rail: RailCard[] = [
    ...ads.map((a) => ({
      key: `ad-${a.bookingId}`,
      href: a.href,
      external: true,
      name: a.name,
      tagline: a.tagline,
      logoUrl: a.logoUrl,
    })),
    ...items
      .filter((i) => !heroes.includes(i))
      .map((f) => ({
        key: f.slug,
        href: `/p/${f.slug}`,
        external: false,
        name: f.name,
        tagline: f.tagline,
        logoUrl: f.logoUrl,
        clap: applause.get(f.slug),
      })),
  ].slice(0, 6);
  const shownAds = ads.filter((a) => rail.some((r) => r.key === `ad-${a.bookingId}`) && a.bookingId);

  return (
    <section aria-label="Featured" className="mb-8 space-y-3">
      {heroes.map((h) => {
        const clap = applause.get(h.slug);
        return (
          <div
            key={h.slug}
            className="flex items-center gap-4 rounded-lg border border-accent bg-accent/10 p-5 transition-colors hover:bg-accent/20"
          >
            <Link href={`/p/${h.slug}`} className="flex min-w-0 flex-1 items-center gap-4">
              <ProductLogo name={h.name} src={h.logoUrl} className="size-14" />
              <div className="min-w-0 flex-1">
                <Badge tone="accent">Spotlight</Badge>
                <p className="mt-1 font-display text-lg font-semibold">{h.name}</p>
                <p className="truncate text-sm text-muted-foreground">{h.tagline}</p>
              </div>
            </Link>
            {clap && <Clap state={clap} signedIn={signedIn} />}
          </div>
        );
      })}
      {rail.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Featured</p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {rail.map((f) => {
              const body = (
                <>
                  <ProductLogo name={f.name} src={f.logoUrl} className="size-10" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{f.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{f.tagline}</p>
                  </div>
                </>
              );
              const link = "flex min-w-0 flex-1 items-center gap-3";
              return (
                <li
                  key={f.key}
                  className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-foreground/20"
                >
                  {f.external ? (
                    <a href={f.href} rel="sponsored noopener" target="_blank" className={link}>
                      {body}
                    </a>
                  ) : (
                    <Link href={f.href} className={link}>
                      {body}
                    </Link>
                  )}
                  {f.clap && <Clap state={f.clap} signedIn={signedIn} />}
                </li>
              );
            })}
          </ul>
          {shownAds.length > 0 && <AdImpressions ids={shownAds.map((a) => a.bookingId!)} />}
        </div>
      )}
    </section>
  );
}

function Clap({ state, signedIn }: { state: ApplauseState; signedIn?: boolean }) {
  return (
    <ClapButton
      productId={state.id}
      applauded={state.applaudedByMe}
      applause={state.applause}
      final={state.applauseFinal}
      signedIn={signedIn}
    />
  );
}
