import "server-only";
import { safeFetchText, UnsafeUrlError } from "@/lib/net";
import { spend, ToolError, type ToolCaller } from "@/lib/tools/service";
import { withDraftedCopy } from "./ai-prefill";
import { extractPrefill, type Prefill } from "./prefill";

/** Claude drafts per caller per hour; past that, "Fill from site" reads metadata only. */
export const AI_DRAFTS_PER_HOUR = 10;

/** Fetches a site and suggests listing details, with Claude-drafted copy when available. */
export async function prefillFromSite(
  url: string,
  caller: ToolCaller,
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
  const base = extractPrefill(page.body, page.url);
  try {
    await spend("ai_prefill", page.url, caller, AI_DRAFTS_PER_HOUR);
  } catch (err) {
    if (err instanceof ToolError && err.rateLimited) return { ok: true, data: base };
    throw err;
  }
  return { ok: true, data: await withDraftedCopy(base, page.body) };
}
