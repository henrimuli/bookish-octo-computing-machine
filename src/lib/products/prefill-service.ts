import "server-only";
import { safeFetchText, UnsafeUrlError } from "@/lib/net";
import { extractPrefill, prefillPages, type Prefill } from "./prefill";

/** Time allowed for the extra pages (features, pricing, about), read in parallel after the homepage. */
const EXTRA_PAGES_MS = 2500;

/** Fetches a site and suggests listing details, with copy built from its homepage and a couple of linked pages. */
export async function prefillFromSite(
  url: string,
): Promise<{ ok: true; data: Prefill } | { ok: false; error: string }> {
  const normalized = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
  let page: Awaited<ReturnType<typeof safeFetchText>>;
  try {
    page = await safeFetchText(normalized, { timeoutMs: 8000 });
  } catch (err) {
    if (err instanceof UnsafeUrlError) return { ok: false, error: err.message };
    return { ok: false, error: "We couldn't reach that site. You can fill the details in by hand." };
  }
  if (page.status >= 400) return { ok: false, error: `Your site returned HTTP ${page.status}.` };

  // Pages that are slow, fail or aren't HTML are skipped; the homepage alone still fills the form.
  const extra = await Promise.allSettled(
    prefillPages(page.body, page.url).map((u) => safeFetchText(u, { timeoutMs: EXTRA_PAGES_MS, maxBytes: 800_000 })),
  );
  const pages = extra.flatMap((r) =>
    r.status === "fulfilled" && r.value.status < 400 && r.value.contentType.includes("html")
      ? [{ html: r.value.body, url: r.value.url }]
      : [],
  );
  return { ok: true, data: extractPrefill(page.body, page.url, pages) };
}
