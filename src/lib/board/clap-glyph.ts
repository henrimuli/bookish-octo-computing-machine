/**
 * The clap mark: two palms meeting at the top, with three spark ticks above.
 * One source for the React icon and the SVG badge, drawn on a 24×24 grid. Pure.
 */

/** One palm with its thumb, drawn upright with its base at the origin, then placed. */
const palm = (transform: string, fingers = false) =>
  `<g transform="${transform}"><rect x="-3.2" y="-15" width="6.4" height="15" rx="3.2"/>` +
  `<rect x="-6.3" y="-9.2" width="2.8" height="6.2" rx="1.4" transform="rotate(-30 -4.9 -6.1)"/>` +
  (fingers ? `<path d="M-1.05 -13.2v4.4M1.05 -13.2v4.4" fill="none" stroke-linecap="round"/>` : "") +
  `</g>`;

export function clapGlyph({ fill, stroke, spark }: { fill: string; stroke: string; spark: string }): string {
  return (
    `<g fill="${fill}" stroke="${stroke}" stroke-width="1.5" stroke-linejoin="round">` +
    // The back hand sits a little higher and to the right; the front one shows its fingers.
    palm("translate(15.6 21.6) rotate(-19) scale(-1 1)") +
    palm("translate(8.6 22.8) rotate(13)", true) +
    `</g>` +
    `<g class="clap-sparks" stroke="${spark}" stroke-width="1.5" stroke-linecap="round" fill="none">` +
    `<path d="M12 1.2v2.3M7.4 2.4l1 1.9M16.6 2.4l-1 1.9"/></g>`
  );
}
