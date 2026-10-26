import { Badge } from "@/components/ui/primitives";

type WallLink = {
  id: string;
  url: string;
  target: string;
  verdict: "dofollow" | "nofollow" | "missing" | "unreachable" | null;
  directory: string | null;
  directoryDr: number | null;
};

const host = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
};

/** A maker's machine-verified backlinks, for their public profile. */
export function WallLinks({ links }: { links: WallLink[] }) {
  return (
    <ul className="divide-y divide-border rounded-lg border border-border text-sm">
      {links.map((l) => (
        <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
          <a href={l.url} rel="nofollow noopener" target="_blank" className="min-w-0 break-all hover:underline">
            {l.directory ?? host(l.url)}
            <span className="ml-2 text-muted-foreground">→ {l.target}</span>
          </a>
          <span className="flex items-center gap-2">
            {l.directoryDr !== null && (
              <span className="text-xs text-muted-foreground">DR {Math.round(l.directoryDr)}</span>
            )}
            <Badge tone={l.verdict === "dofollow" ? "success" : "default"}>{l.verdict}</Badge>
          </span>
        </li>
      ))}
    </ul>
  );
}
