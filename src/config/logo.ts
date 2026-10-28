/**
 * The DebutYard mark: a rounded "stage" triangle with a curtain notch in its
 * base, on a brand-colour disc. Drawn on a 24×24 grid; the path is filled and
 * stroked in the same colour with round joins, which softens every corner.
 * Shared by the site logo, the badge SVG and the files in public/icons.
 */
export const LOGO = {
  viewBox: 24,
  disc: { cx: 12, cy: 12, r: 11 },
  mark: "M6.4 16.4 12 5.6l5.6 10.8h-3.5L12 12.3l-2.1 4.1H6.4Z",
  strokeWidth: 1.4,
} as const;

/** The mark as a standalone SVG string, e.g. for icon files. */
export function logoSvg({ disc, ink, size = 24 }: { disc: string; ink: string; size?: number }): string {
  const { cx, cy, r } = LOGO.disc;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24"><circle cx="${cx}" cy="${cy}" r="${r}" fill="${disc}"/><path d="${LOGO.mark}" fill="${ink}" stroke="${ink}" stroke-width="${LOGO.strokeWidth}" stroke-linejoin="round"/></svg>`;
}
