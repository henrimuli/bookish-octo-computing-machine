import { chartPoints, drChange, type DrPoint } from "@/lib/metrics/providers";

const W = 320;
const H = 80;
const day = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** A small SVG line chart of Domain Rating over time, with "DR 7 → 19 since …". No chart library. */
export function DrChart({ points, since = "intake" }: { points: DrPoint[]; since?: string }) {
  const change = drChange(points);
  if (!change) return null;
  const xy = chartPoints(points, W, H);
  const sorted = [...points].sort((a, b) => a.at.getTime() - b.at.getTime());
  const tone = change.delta > 0 ? "text-success" : change.delta < 0 ? "text-danger" : "text-muted-foreground";
  return (
    <figure className="space-y-2">
      <figcaption className="flex flex-wrap items-baseline gap-x-2 text-sm">
        <span className="font-display text-xl font-bold">
          DR {change.from} → {change.to}
        </span>
        <span className={tone}>
          {change.delta > 0 ? "+" : ""}
          {change.delta} since {since}
        </span>
      </figcaption>
      {xy.length > 1 ? (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-20 w-full max-w-md text-primary"
          role="img"
          aria-label={`Domain Rating from ${change.from} to ${change.to}`}
          preserveAspectRatio="none"
        >
          <polyline
            points={xy.map(([x, y]) => `${x},${y}`).join(" ")}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          {xy.map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="2.5" fill="currentColor">
              <title>
                {day(sorted[i].at)}: DR {sorted[i].dr}
              </title>
            </circle>
          ))}
        </svg>
      ) : (
        <p className="text-xs text-muted-foreground">Measured {day(sorted[0].at)}. We re-check every week.</p>
      )}
      {xy.length > 1 && (
        <p className="flex max-w-md justify-between text-xs text-muted-foreground">
          <span>{day(sorted[0].at)}</span>
          <span>{day(sorted[sorted.length - 1].at)}</span>
        </p>
      )}
    </figure>
  );
}
