import { clapGlyph } from "@/lib/board/clap-glyph";
import { cn } from "@/lib/utils";

// The glyph is a constant path, so injecting it is safe.
const outline = clapGlyph({ color: "currentColor" });
const filled = clapGlyph({ color: "currentColor", filled: true });

/** Clapping hands: outlined, or filled once the viewer has applauded. */
export function ClapIcon({ on = false, className }: { on?: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden
      className={cn("size-4 shrink-0", className)}
      dangerouslySetInnerHTML={{ __html: on ? filled : outline }}
    />
  );
}

/** "👏 12" for lists: the icon plus a count, labelled for screen readers. */
export function ApplauseCount({ count, className }: { count: number; className?: string }) {
  return (
    <span
      className={cn("inline-flex items-center gap-1 tabular-nums", className)}
      aria-label={`${count} applause`}
      title={`${count} applause`}
    >
      <ClapIcon />
      {count}
    </span>
  );
}
