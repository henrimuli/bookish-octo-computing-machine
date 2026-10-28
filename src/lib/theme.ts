/**
 * Colour theme: "system" follows the OS (the default, including for new
 * visitors); "light" and "dark" are stored in localStorage and applied as
 * data-theme on <html>, which globals.css reads.
 */
export type ThemeChoice = "system" | "light" | "dark";

export const THEME_KEY = "debutyard:theme";

/** Runs in <head> before first paint so a stored choice never flashes the wrong theme. */
export const themeScript = `try{var t=localStorage.getItem("${THEME_KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export function readTheme(): ThemeChoice {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

export function applyTheme(choice: ThemeChoice) {
  try {
    if (choice === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, choice);
  } catch {
    // Storage blocked: the choice still applies to this page.
  }
  if (choice === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = choice;
}
