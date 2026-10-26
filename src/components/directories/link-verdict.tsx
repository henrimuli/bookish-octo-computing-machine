import { Badge } from "@/components/ui/primitives";

const LABEL = {
  dofollow: "✓ dofollow",
  nofollow: "nofollow",
  missing: "link missing",
  unreachable: "unreachable",
} as const;

/** The machine-verified result of the latest link check. */
export function LinkVerdict({
  verdict,
  anchor,
  checkedAt,
}: {
  verdict: keyof typeof LABEL | null;
  anchor?: string | null;
  checkedAt?: Date | string | null;
}) {
  if (!verdict) return <span className="text-xs text-muted-foreground">not checked</span>;
  const tone = verdict === "dofollow" ? "success" : verdict === "nofollow" ? "default" : "accent";
  const when = checkedAt ? new Date(checkedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : null;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Badge tone={tone}>{LABEL[verdict]}</Badge>
      {anchor && verdict !== "missing" && (
        <span className="max-w-40 truncate text-xs text-muted-foreground">“{anchor}”</span>
      )}
      {when && <span className="text-xs text-muted-foreground">{when}</span>}
    </span>
  );
}
