import { Badge } from "@/components/ui/primitives";
import type { Directory } from "@/lib/directories/service";

const NICHE: Record<Directory["niche"], string> = {
  general: "General",
  devtools: "Dev tools",
  ai: "AI",
  indie: "Indie",
  b2b: "B2B",
};

/** Pricing, link type, badge and guided flags for a directory. */
export function DirectoryBadges({ directory: d }: { directory: Directory }) {
  const link = d.linkTypeObserved !== "unknown" ? d.linkTypeObserved : d.linkTypeClaimed;
  return (
    <div className="flex flex-wrap gap-1.5">
      <Badge>{NICHE[d.niche]}</Badge>
      <Badge>{d.pricing}</Badge>
      {link !== "unknown" && (
        <Badge tone={link === "dofollow" ? "success" : "default"}>
          {link}
          {d.linkTypeObserved !== "unknown" && " ✓"}
        </Badge>
      )}
      {d.badgeRequired && <Badge tone="accent">badge required</Badge>}
      {d.guided && <Badge tone="accent">needs the maker</Badge>}
    </div>
  );
}
