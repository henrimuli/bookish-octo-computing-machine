import { cn } from "@/lib/utils";

/** Maker-supplied logo, or a lettermark when there isn't one. */
export function ProductLogo({ name, src, className }: { name: string; src: string | null; className?: string }) {
  if (src) {
    return (
      // External maker logos; next/image would need every host allow-listed.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={`${name} logo`}
        loading="lazy"
        className={cn("size-12 shrink-0 rounded-md border border-border bg-card object-contain", className)}
      />
    );
  }
  return (
    <div
      aria-hidden
      className={cn(
        "flex size-12 shrink-0 items-center justify-center rounded-md bg-primary/10 font-display text-lg font-bold text-primary",
        className,
      )}
    >
      {name.slice(0, 1).toUpperCase()}
    </div>
  );
}
