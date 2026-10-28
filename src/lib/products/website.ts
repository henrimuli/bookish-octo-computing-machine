/**
 * Turns what a maker types into a website URL we can fetch: adds a missing
 * https://, fixes mangled schemes ("https//", "htps://"), lowercases the host
 * and drops a bare trailing slash. Pure, shared by the form and tests.
 */
export function normalizeWebsite(raw: string): { ok: true; url: string } | { ok: false; error: string } {
  let s = raw.trim().replace(/\s+/g, "");
  if (!s) return { ok: false, error: "Enter your website address." };

  // Common slips in the scheme.
  s = s.replace(/^(h?t?t?p?s?)[:;]*\/*(?=[^/])/i, (m, scheme: string) => {
    if (!m.includes("/") && !m.includes(":") && !m.includes(";")) return m; // no scheme was typed
    return /^h?t?t?p$/i.test(scheme) ? "http://" : "https://";
  });
  if (!/^https?:\/\//i.test(s)) s = `https://${s.replace(/^\/+/, "")}`;

  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return { ok: false, error: "That doesn't look like a website address. Try something like yourproduct.com." };
  }
  const host = url.hostname.toLowerCase();
  const labels = host.split(".");
  const tld = labels.at(-1) ?? "";
  if (
    labels.length < 2 ||
    !/^[a-z]{2,63}$|^xn--[a-z0-9-]+$/.test(tld) ||
    labels.some((l) => !l || !/^[a-z0-9-]+$/.test(l) || l.startsWith("-") || l.endsWith("-"))
  ) {
    return { ok: false, error: "That doesn't look like a website address. Try something like yourproduct.com." };
  }
  if (url.username || url.password) return { ok: false, error: "Remove the username or password from the address." };

  url.hostname = host;
  url.hash = "";
  const out = url.toString();
  return { ok: true, url: url.pathname === "/" && !url.search ? out.replace(/\/$/, "") : out };
}
