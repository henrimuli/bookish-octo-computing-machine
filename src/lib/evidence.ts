import "server-only";
import { env } from "@/env";

/**
 * Screenshots from the screenshot worker (workers/screenshot), which runs
 * Playwright off Vercel and stores PNGs in R2: directory evidence, and the
 * homepage capture on the debut form. Optional: without WORKER_URL, staff
 * paste evidence links by hand and makers upload their own screenshots.
 */

export const evidenceEnabled = () => Boolean(env().WORKER_URL && env().WORKER_SECRET);

let override: ((url: string, key: string) => Promise<string | null>) | undefined;

/** Test-only: replace the worker call. */
export function setEvidenceForTests(fn: typeof override) {
  override = fn;
}

/** Screenshots `url` and returns the image's public URL, or null. Never throws. */
export async function captureEvidence(url: string, key: string): Promise<string | null> {
  if (override) return override(url, key);
  const { WORKER_URL, WORKER_SECRET } = env();
  if (!WORKER_URL || !WORKER_SECRET) return null;
  try {
    const res = await fetch(new URL("/screenshot", WORKER_URL), {
      method: "POST",
      headers: { Authorization: `Bearer ${WORKER_SECRET}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, key }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) throw new Error(`worker returned HTTP ${res.status}`);
    const body = (await res.json()) as { url?: unknown };
    return typeof body.url === "string" && /^https:\/\//.test(body.url) ? body.url : null;
  } catch (err) {
    console.error("evidence screenshot failed", url, err);
    return null;
  }
}

/** Storage key for a screenshot: evidence/<id>/<timestamp>.png */
export const evidenceKey = (id: string, now: Date) => `evidence/${id}/${now.toISOString().replace(/[:.]/g, "-")}.png`;
