/** Badge artwork as SVG. Pure, so it can be tested and served from a route. */

export type BadgeVariant = { kind: "featured" | "winner"; theme: "light" | "dark"; place?: number; votes?: number };

const palette = {
  light: { bg: "#ffffff", border: "#e6e2d8", text: "#17150f", muted: "#6b6658" },
  dark: { bg: "#17150f", border: "#2c2a24", text: "#f2efe7", muted: "#a39d8e" },
};

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

export const BADGE_WIDTH = 220;
export const BADGE_HEIGHT = 54;

export function badgeSvg(v: BadgeVariant): string {
  const c = palette[v.theme];
  const winner = v.kind === "winner" && v.place && v.place <= 3;
  const top = winner ? `#${v.place} DEBUT OF THE WEEK` : "FEATURED ON";
  const accent = winner ? ["", "#d4a017", "#9aa0a6", "#b8733d"][v.place!] : "#e4572e";
  const votes =
    typeof v.votes === "number"
      ? `<text x="198" y="33" text-anchor="middle" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="13" font-weight="700" fill="${c.text}">${v.votes}</text>
  <path d="M193 20.5 198 14l5 6.5z" fill="${c.text}"/>`
      : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${BADGE_WIDTH}" height="${BADGE_HEIGHT}" viewBox="0 0 ${BADGE_WIDTH} ${BADGE_HEIGHT}" role="img" aria-label="${esc(top.toLowerCase())} DebutYard">
  <rect x="0.5" y="0.5" width="${BADGE_WIDTH - 1}" height="${BADGE_HEIGHT - 1}" rx="10" fill="${c.bg}" stroke="${c.border}"/>
  <circle cx="27" cy="27" r="15" fill="${accent}"/>
  <path d="M20.5 32 27 19.5 33.5 32z" fill="#ffffff"/>
  <text x="52" y="22" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="9" font-weight="600" letter-spacing="0.6" fill="${c.muted}">${esc(top)}</text>
  <text x="52" y="40" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="17" font-weight="800" fill="${c.text}">Debut<tspan fill="#e4572e">Yard</tspan></text>
  ${votes}
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
