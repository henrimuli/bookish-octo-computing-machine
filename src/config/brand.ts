/**
 * Brand colours for places CSS variables can't reach (badge SVGs, OG images).
 * Evergreen and near-black, shared with the Cleanly design language; keep in
 * sync with the tokens in src/app/globals.css.
 */
export const brand = {
  light: {
    bg: "#F3F7F5",
    surface: "#FFFFFF",
    border: "#DCE6E2",
    text: "#10201B",
    muted: "#52675F",
    primary: "#0E9F6A",
    primaryInk: "#FFFFFF",
  },
  dark: {
    bg: "#0D1714",
    surface: "#13211D",
    border: "#233832",
    text: "#E9F3EF",
    muted: "#8FA89F",
    primary: "#3BE0A0",
    primaryInk: "#04251A",
  },
  /** Medal colours for winner badges: gold, silver, bronze. */
  medals: ["#D9A520", "#9FB0AA", "#B87A45"],
} as const;
