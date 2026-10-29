import { AdImpressions } from "@/components/ads/ad-impressions";
import type { AdItem } from "@/lib/ads/service";
import type { CardMedia, FeaturedItem } from "@/lib/board/featured";
import { withRef } from "@/lib/board/links";
import type { ApplauseState } from "@/lib/board/queries";
import { domainOf } from "@/lib/slug";
import { cn } from "@/lib/utils";
import { ClapButton } from "./clap-button";
import { ProductCard } from "./product-card";

/** One card wide on phones, two on tablets, three on desktop; a short row centres itself. */
const CARD_WIDTH = "w-full sm:w-[calc((100%-1.5rem)/2)] lg:w-[calc((100%-3rem)/3)]";

/**
 * The Spotlight (3 spots at any time, enforced at checkout) and the featured
 * cards: booked rail slots first, then every paid debut inside its featured
 * window, however many there are. A listing is in one or the other, never both
 * (and a booked ad takes the place of its own listing). Listings carry a clap button (all-time applause),
 * so they keep collecting applause for as long as they're featured; booked ads
 * don't. The rest of the board stays as rows.
 */
export function FeaturedRail({
  items,
  ads = [],
  applause = new Map(),
  media = new Map(),
  signedIn,
}: {
  items: FeaturedItem[];
  ads?: AdItem[];
  /** Clap state by slug, from applauseForSlugs. */
  applause?: Map<string, ApplauseState>;
  /** Screenshot and site by slug, from cardMediaForSlugs. */
  media?: Map<string, CardMedia>;
  signedIn?: boolean;
}) {
  if (items.length === 0 && ads.length === 0) return null;
  const heroes = items.filter((i) => i.hero);
  const adSlugs = new Set(ads.map((a) => a.slug));
  const listings = items.filter((i) => !i.hero && !adSlugs.has(i.slug));
  const adIds = ads.flatMap((a) => (a.bookingId ? [a.bookingId] : []));

  const listingCard = (f: FeaturedItem, spotlight: boolean) => {
    const m = media.get(f.slug);
    const clap = applause.get(f.slug);
    return (
      <ProductCard
        key={f.slug}
        className={CARD_WIDTH}
        spotlight={spotlight}
        name={f.name}
        tagline={f.tagline}
        logoUrl={f.logoUrl}
        imageUrl={m?.imageUrl ?? null}
        link={{ href: `/p/${f.slug}`, external: false }}
        // Paid listings, so the link is followed (see listingRel).
        site={m ? { href: withRef(m.websiteUrl), domain: domainOf(m.websiteUrl), rel: "noopener" } : null}
        action={
          clap && (
            <ClapButton
              productId={clap.id}
              applauded={clap.applaudedByMe}
              applause={clap.applause}
              final={clap.applauseFinal}
              signedIn={signedIn}
            />
          )
        }
      />
    );
  };

  return (
    <div className="mb-10 space-y-10">
      {heroes.length > 0 && (
        <section aria-labelledby="spotlight-heading">
          <h3
            id="spotlight-heading"
            className="mb-5 flex items-center justify-center gap-2 font-display text-2xl font-semibold italic"
          >
            <Laurel />
            Spotlight
            <Laurel flip />
          </h3>
          <ul className="flex flex-wrap justify-center gap-6">{heroes.map((h) => listingCard(h, true))}</ul>
        </section>
      )}
      {(ads.length > 0 || listings.length > 0) && (
        <section aria-labelledby="featured-heading">
          <h3
            id="featured-heading"
            className="mb-4 text-center text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground"
          >
            Featured
          </h3>
          <ul className="flex flex-wrap justify-center gap-6">
            {ads.map((a) => {
              const m = media.get(a.slug);
              return (
                <ProductCard
                  key={`ad-${a.bookingId ?? a.slug}`}
                  className={CARD_WIDTH}
                  name={a.name}
                  tagline={a.tagline}
                  logoUrl={a.logoUrl}
                  imageUrl={m?.imageUrl ?? null}
                  link={{ href: a.href, external: Boolean(a.bookingId) }}
                  label="Ad"
                  // The chip goes through the tracked click too.
                  site={m ? { href: a.href, domain: domainOf(m.websiteUrl), rel: "sponsored noopener" } : null}
                />
              );
            })}
            {listings.map((f) => listingCard(f, false))}
          </ul>
          {adIds.length > 0 && <AdImpressions ids={adIds} />}
        </section>
      )}
    </div>
  );
}

/** A laurel sprig either side of the Spotlight heading. */
function Laurel({ flip = false }: { flip?: boolean }) {
  const leaves = [
    [9, 31, -55],
    [7, 24, -35],
    [7, 17, -15],
    [9, 10, 5],
  ];
  return (
    <svg
      viewBox="0 0 24 40"
      aria-hidden
      className={cn("h-9 w-6 shrink-0 text-accent", flip && "-scale-x-100")}
      fill="currentColor"
      stroke="currentColor"
    >
      <path d="M17 38C9 31 7 19 13 4" fill="none" strokeWidth="1.4" strokeLinecap="round" />
      {leaves.map(([x, y, r]) => (
        <ellipse key={y} cx={x} cy={y} rx="2" ry="4.2" transform={`rotate(${r} ${x} ${y})`} stroke="none" />
      ))}
      {leaves.slice(0, 3).map(([x, y, r]) => (
        <ellipse
          key={`r${y}`}
          cx={x + 8}
          cy={y - 1}
          rx="1.8"
          ry="3.8"
          transform={`rotate(${-r + 10} ${x + 8} ${y - 1})`}
          stroke="none"
        />
      ))}
    </svg>
  );
}
