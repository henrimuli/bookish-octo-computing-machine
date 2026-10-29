import Link from "next/link";
import { cn } from "@/lib/utils";
import { ProductLogo } from "./product-logo";

export type CardLink = {
  href: string;
  /** Off-site (a tracked ad click), opened in a new tab as a sponsored link. */
  external: boolean;
};

/**
 * Sponsored product card for the homepage: the first screenshot, then name and
 * tagline with an optional action at the end (the clap button, as on board
 * rows), then the site's domain. The whole card links to `link`; the action
 * and domain chip sit above it.
 */
export function ProductCard({
  name,
  tagline,
  logoUrl,
  imageUrl,
  link,
  site,
  label,
  action,
  spotlight = false,
  className,
}: {
  name: string;
  tagline: string;
  logoUrl: string | null;
  /** Without a screenshot (listings from before they were required), the logo stands in. */
  imageUrl: string | null;
  link: CardLink;
  site: { href: string; domain: string; rel: string } | null;
  /** Small tag over the image, e.g. "Ad". */
  label?: string;
  action?: React.ReactNode;
  spotlight?: boolean;
  className?: string;
}) {
  const stretched = "after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none";
  return (
    <li className={cn("group relative flex flex-col", className)}>
      <div
        className={cn(
          "relative aspect-[16/10] overflow-hidden rounded-xl border bg-muted shadow-sm transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-lg group-has-[a:focus-visible]:ring-2 group-has-[a:focus-visible]:ring-ring",
          spotlight ? "border-accent/70 ring-1 ring-accent/40" : "border-border",
        )}
      >
        {imageUrl ? (
          // Maker uploads on R2; next/image would need the bucket host allow-listed.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            loading="lazy"
            className="size-full object-cover object-top transition duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="grid size-full place-items-center bg-gradient-to-br from-primary/15 via-muted to-accent/15">
            <ProductLogo name={name} src={logoUrl} className="size-16 shadow-sm" />
          </div>
        )}
        {label && (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-background/85 px-2 py-0.5 text-[11px] font-medium text-muted-foreground backdrop-blur">
            {label}
          </span>
        )}
      </div>
      <div className="mt-3 flex items-start gap-3 px-0.5">
        <ProductLogo name={name} src={logoUrl} className="size-9" />
        <div className="min-w-0 flex-1">
          {link.external ? (
            <a
              href={link.href}
              rel="sponsored noopener"
              target="_blank"
              className={cn("block truncate font-semibold group-hover:text-primary", stretched)}
            >
              {name}
            </a>
          ) : (
            <Link href={link.href} className={cn("block truncate font-semibold group-hover:text-primary", stretched)}>
              {name}
            </Link>
          )}
          <p className="truncate text-sm text-muted-foreground">{tagline}</p>
        </div>
        {action && <div className="relative z-10 shrink-0">{action}</div>}
      </div>
      {site && (
        <div className="relative z-10 mt-2.5 flex px-0.5">
          <a
            href={site.href}
            rel={site.rel}
            target="_blank"
            className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
          >
            <span className="truncate">{site.domain}</span>
            <svg viewBox="0 0 16 16" aria-hidden className="size-3 shrink-0" fill="none" stroke="currentColor">
              <path d="M5 11 11 5M6 5h5v5" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>
      )}
    </li>
  );
}
