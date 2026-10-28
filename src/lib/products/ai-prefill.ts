import "server-only";
import { z } from "zod";
import { env } from "@/env";
import { decodeEntities } from "@/lib/html";
import type { Prefill } from "./prefill";

/**
 * Free-tier Gemini models, tried in order. A model that's busy, out of free
 * quota, retired or returns unusable output hands over to the next one.
 */
export const GEMINI_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-3-flash-preview",
  "gemini-3.5-flash-lite",
  "gemini-3.1-flash-lite",
] as const;
const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta/models";
/** Per model, and for the whole chain, so a slow day can't stall the form. */
const MODEL_TIMEOUT_MS = 12_000;
const TOTAL_TIMEOUT_MS = 30_000;
/** Enough page text to describe a product; the rest is usually footer and legal. */
const MAX_PAGE_CHARS = 30_000;

export const LIMITS = { tagline: 60, short: 160, long: 500 } as const;

const Copy = z.object({
  tagline: z.string(),
  shortDescription: z.string(),
  longDescription: z.string(),
});
export type Copy = z.infer<typeof Copy>;
export type Drafter = (input: { url: string; name?: string; text: string }) => Promise<Copy | null>;

/** Readable text of a page: no scripts, styles or tags, whitespace collapsed. Pure. */
export function pageText(html: string): string {
  const body = html
    .replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|h[1-6]|section|br|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(body)
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim()
    .slice(0, MAX_PAGE_CHARS);
}

/** Trims to `max` characters at a word boundary, without a dangling separator. Pure. */
export function fit(s: string, max: number): string {
  const v = s.replace(/\s+/g, " ").trim();
  if (v.length <= max) return v;
  const cut = v.slice(0, max + 1);
  const end = cut.lastIndexOf(" ");
  return (end > max * 0.6 ? cut.slice(0, end) : v.slice(0, max)).replace(/[\s,;:–—-]+$/, "");
}

const SYSTEM = `You write launch-directory copy for software products, using only what the product's own homepage says.

Return three fields:
- tagline: one line of at most ${LIMITS.tagline} characters saying what the product does for whom. No product name, no trailing period, no hype words like "revolutionary" or "best".
- shortDescription: one or two sentences, at most ${LIMITS.short} characters, for directory cards.
- longDescription: a plain paragraph of at most ${LIMITS.long} characters: what it does, who it's for, and the main features the page mentions.

Write in a plain, specific, third-person voice. Don't invent pricing, numbers, integrations or claims the page doesn't make. If the page says little, keep the copy short rather than padding it.`;

let override: Drafter | null | undefined;

/** Tests swap the model call; `null` behaves as if no API key were set. */
export function setDrafterForTests(fn: Drafter | null | undefined) {
  override = fn;
}

const responseSchema = {
  type: "OBJECT",
  properties: {
    tagline: { type: "STRING" },
    shortDescription: { type: "STRING" },
    longDescription: { type: "STRING" },
  },
  required: ["tagline", "shortDescription", "longDescription"],
  propertyOrdering: ["tagline", "shortDescription", "longDescription"],
};

type GeminiResponse = {
  candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string }> } }>;
};

/** A bad or missing key fails the same way on every model, so stop instead of walking the list. */
class FatalGeminiError extends Error {}

/**
 * Asks each model in turn for JSON copy. Returns the first usable draft, or
 * null when every model is busy, out of quota or unhelpful. Exported for tests.
 */
export async function draftWithGemini(
  input: Parameters<Drafter>[0],
  opts: { apiKey: string; models?: readonly string[]; fetch?: typeof fetch; now?: () => number },
): Promise<Copy | null> {
  const doFetch = opts.fetch ?? fetch;
  const now = opts.now ?? Date.now;
  const deadline = now() + TOTAL_TIMEOUT_MS;
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Homepage: ${input.url}${
              input.name
                ? `
Product name: ${input.name}`
                : ""
            }

<page_text>
${input.text}
</page_text>`,
          },
        ],
      },
    ],
    generationConfig: { responseMimeType: "application/json", responseSchema, temperature: 0.4 },
  });

  for (const model of opts.models ?? GEMINI_MODELS) {
    const left = deadline - now();
    if (left <= 0) break;
    try {
      const res = await doFetch(`${GEMINI_API}/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": opts.apiKey },
        body,
        signal: AbortSignal.timeout(Math.min(MODEL_TIMEOUT_MS, left)),
      });
      if (!res.ok) {
        const detail = (await res.text().catch(() => "")).slice(0, 300);
        if (res.status === 401 || res.status === 403 || /API_KEY_INVALID|API key not valid/i.test(detail)) {
          throw new FatalGeminiError(`Gemini rejected the API key (${res.status})`);
        }
        // 429 quota, 503 overloaded, 404 retired model, 5xx: try the next model.
        console.warn(`Gemini ${model} failed (${res.status}); trying the next model`);
        continue;
      }
      const data = (await res.json()) as GeminiResponse;
      const candidate = data.candidates?.[0];
      const text = candidate?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      const parsed = Copy.safeParse(text ? JSON.parse(text) : null);
      if (parsed.success) return parsed.data;
      console.warn(
        `Gemini ${model} returned unusable output (${candidate?.finishReason ?? "empty"}); trying the next model`,
      );
    } catch (err) {
      if (err instanceof FatalGeminiError) throw err;
      console.warn(`Gemini ${model} errored; trying the next model`, err instanceof Error ? err.message : err);
    }
  }
  return null;
}

const geminiDrafter: Drafter = (input) => draftWithGemini(input, { apiKey: env().GEMINI_API_KEY! });

function drafter(): Drafter | null {
  if (override !== undefined) return override;
  return env().GEMINI_API_KEY ? geminiDrafter : null;
}

/**
 * Drafts tagline and short/long descriptions from the page with Gemini.
 * Metadata extraction stays the fallback: with no key, a thin page, every
 * model failing or any other error, the prefill is returned unchanged.
 */
export async function withDraftedCopy(prefill: Prefill, html: string): Promise<Prefill> {
  const draft = drafter();
  const text = pageText(html);
  if (!draft || text.length < 80) return prefill;
  try {
    const copy = await draft({ url: prefill.url, name: prefill.name, text });
    if (!copy) return prefill;
    const tagline = fit(copy.tagline, LIMITS.tagline).replace(/\.$/, "");
    const shortDescription = fit(copy.shortDescription, LIMITS.short);
    const longDescription = fit(copy.longDescription, LIMITS.long);
    if (tagline.length < 10 || longDescription.length < 40) return prefill;
    return { ...prefill, tagline, shortDescription, description: longDescription, drafted: true };
  } catch (err) {
    console.error("AI prefill failed", err);
    return prefill;
  }
}
