import "server-only";
import { randomUUID } from "node:crypto";
import { captureEvidence } from "@/lib/evidence";
import { safeFetchBytes } from "@/lib/net";
import { MAX_UPLOAD_BYTES, putObject } from "@/lib/storage";

/** Homepage images per maker per hour (an OG import or a worker capture, which is a full browser load). */
export const SCREENSHOTS_PER_HOUR = 20;

/** Screenshots a product's homepage (1280×900) with the screenshot worker. Returns the R2 URL, or null. */
export function captureHomepage(url: string): Promise<string | null> {
  return captureEvidence(url, `screenshots/${randomUUID()}.png`);
}

/** Smaller than this is a favicon or a tracking pixel, not a preview image. */
const MIN_IMAGE_BYTES = 2_000;

/** The raster type of an image from its first bytes (not its Content-Type header), or null. Pure. */
export function imageType(bytes: Uint8Array): { contentType: string; ext: string } | null {
  const starts = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  if (starts(0x89, 0x50, 0x4e, 0x47)) return { contentType: "image/png", ext: "png" };
  if (starts(0xff, 0xd8, 0xff)) return { contentType: "image/jpeg", ext: "jpg" };
  if (starts(0x47, 0x49, 0x46, 0x38)) return { contentType: "image/gif", ext: "gif" };
  if (starts(0x52, 0x49, 0x46, 0x46) && String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP") {
    return { contentType: "image/webp", ext: "webp" };
  }
  return null;
}

/**
 * Copies a site's OG image into R2 so the listing doesn't hotlink it. Returns
 * the R2 URL, or null if it isn't a usable PNG/JPEG/GIF/WebP under 5 MB. Never throws.
 */
export async function importOgImage(imageUrl: string): Promise<string | null> {
  try {
    const res = await safeFetchBytes(imageUrl, "image/png,image/jpeg,image/webp,image/gif;q=0.9", {
      maxBytes: MAX_UPLOAD_BYTES,
      timeoutMs: 10_000,
    });
    if (res.status >= 400 || res.truncated || res.body.byteLength < MIN_IMAGE_BYTES) return null;
    const type = imageType(res.body);
    if (!type) return null;
    return await putObject(`screenshots/${randomUUID()}.${type.ext}`, res.body, type.contentType);
  } catch (err) {
    console.error("og image import failed", imageUrl, err);
    return null;
  }
}
