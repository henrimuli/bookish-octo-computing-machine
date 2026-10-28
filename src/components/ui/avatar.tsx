import { cn } from "@/lib/utils";

/** A person's picture, or their initial when there isn't one. Size it with className (default size-8). */
export function Avatar({ name, src, className }: { name: string; src: string | null | undefined; className?: string }) {
  if (src) {
    return (
      // Uploaded or OAuth pictures on hosts next/image would need allow-listed.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        loading="lazy"
        className={cn("size-8 shrink-0 rounded-full border border-border bg-muted object-cover", className)}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        "grid size-8 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary",
        className,
      )}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
