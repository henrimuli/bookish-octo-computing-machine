import "server-only";
import { randomUUID } from "node:crypto";
import { captureEvidence } from "@/lib/evidence";

/** Homepage captures per maker per hour; each one is a full browser load on the worker. */
export const SCREENSHOTS_PER_HOUR = 20;

/** Screenshots a product's homepage (1280×900) with the screenshot worker. Returns the R2 URL, or null. */
export function captureHomepage(url: string): Promise<string | null> {
  return captureEvidence(url, `screenshots/${randomUUID()}.png`);
}
