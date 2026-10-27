import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { env } from "@/env";
import { decodeEntities } from "@/lib/html";
import type { Prefill } from "./prefill";

const MODEL = "claude-sonnet-5-5";
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

let client: Anthropic | undefined;
let override: Drafter | null | undefined;

/** Tests swap the model call; `null` behaves as if no API key were set. */
export function setDrafterForTests(fn: Drafter | null | undefined) {
  override = fn;
}

const claudeDrafter: Drafter = async ({ url, name, text }) => {
  client ??= new Anthropic({ apiKey: env().ANTHROPIC_API_KEY, timeout: 25_000, maxRetries: 1 });
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    output_config: { effort: "low", format: zodOutputFormat(Copy) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Homepage: ${url}${name ? `\nProduct name: ${name}` : ""}\n\n<page_text>\n${text}\n</page_text>`,
      },
    ],
  });
  if (response.stop_reason === "refusal") return null;
  return response.parsed_output ?? null;
};

function drafter(): Drafter | null {
  if (override !== undefined) return override;
  return env().ANTHROPIC_API_KEY ? claudeDrafter : null;
}

/**
 * Drafts tagline and short/long descriptions from the page with Claude.
 * Metadata extraction stays the fallback: with no key, a thin page or any
 * API error, the prefill is returned unchanged.
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
