import { brand } from "@/config/brand";
import { LOGO } from "@/config/logo";
import { clapGlyph } from "@/lib/board/clap-glyph";

/** Badge artwork as SVG. Pure, so it can be tested and served from a route. */

export type BadgeVariant = { kind: "featured" | "winner"; theme: "light" | "dark"; place?: number; applause?: number };

const palette = {
  light: { ...brand.light, bg: brand.light.surface },
  dark: { ...brand.dark, bg: brand.dark.bg },
};

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

export const BADGE_WIDTH = 220;
export const BADGE_HEIGHT = 54;

/** Places the 24-unit logo mark (disc r=11 at 12,12) on the badge disc (r=15 at 27,27). */
const MARK_SCALE = 15 / LOGO.disc.r;
const MARK_TRANSFORM = `translate(${27 - 12 * MARK_SCALE} ${27 - 12 * MARK_SCALE}) scale(${MARK_SCALE})`;

export function badgeSvg(v: BadgeVariant): string {
  const c = palette[v.theme];
  const winner = v.kind === "winner" && v.place && v.place <= 3;
  const top = winner ? `#${v.place} DEBUT OF THE WEEK` : "FEATURED ON";
  const accent = winner ? brand.medals[v.place! - 1] : c.primary;
  const ink = winner ? "#ffffff" : c.primaryInk;
  const applause =
    typeof v.applause === "number"
      ? `<text x="198" y="33" text-anchor="middle" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="13" font-weight="700" fill="${c.text}">${v.applause}</text>
  <g transform="translate(192 8.5) scale(0.5)">${clapGlyph({ fill: c.bg, stroke: c.text, spark: c.primary })}</g>`
      : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${BADGE_WIDTH}" height="${BADGE_HEIGHT}" viewBox="0 0 ${BADGE_WIDTH} ${BADGE_HEIGHT}" role="img" aria-label="${esc(top.toLowerCase())} DebutYard">
  <rect x="0.5" y="0.5" width="${BADGE_WIDTH - 1}" height="${BADGE_HEIGHT - 1}" rx="10" fill="${c.bg}" stroke="${c.border}"/>
  <circle cx="27" cy="27" r="15" fill="${accent}"/>
  <path d="${LOGO.mark}" transform="${MARK_TRANSFORM}" fill="${ink}" stroke="${ink}" stroke-width="${LOGO.strokeWidth}" stroke-linejoin="round"/>
  <text x="52" y="22" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="9" font-weight="600" letter-spacing="0.6" fill="${c.muted}">${esc(top)}</text>
  <text x="52" y="40" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="17" font-weight="800" fill="${c.text}">Debut<tspan fill="${c.primary}">Yard</tspan></text>
  ${applause}
</svg>`;
}

/** The HTML a maker pastes into their site. No rel attribute, so the link is followed. */
export function badgeSnippet(args: {
  siteUrl: string;
  slug: string;
  theme: "light" | "dark";
  kind?: "featured" | "winner";
}) {
  const base = args.siteUrl.replace(/\/$/, "");
  const params = new URLSearchParams({ theme: args.theme, ...(args.kind === "winner" ? { kind: "winner" } : {}) });
  const alt = args.kind === "winner" ? "Debut of the Week on DebutYard" : "Featured on DebutYard";
  return `<a href="${base}/p/${args.slug}?ref=badge" target="_blank"><img src="${base}/badge/${args.slug}?${params}" alt="${alt}" width="${BADGE_WIDTH}" height="${BADGE_HEIGHT}" /></a>`;
}
