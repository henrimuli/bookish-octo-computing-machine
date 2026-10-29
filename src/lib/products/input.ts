import { z } from "zod";

export const MAX_CATEGORIES = 3;
/** Product page gallery: one captured from the homepage on fetch, the rest uploaded. */
export const MAX_SCREENSHOTS = 3;

const httpUrl = z
  .string()
  .trim()
  .url("Enter a full URL, starting with https://")
  .refine((u) => /^https?:\/\//i.test(u), "Only http(s) links");

const optionalUrl = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined))
  .pipe(httpUrl.optional());

/** What a maker can edit on a listing. Shared by the form and the server action. */
export const productInput = z.object({
  websiteUrl: httpUrl,
  name: z.string().trim().min(2, "Name is too short").max(60, "Keep the name under 60 characters"),
  tagline: z.string().trim().min(10, "Tagline is too short").max(80, "Keep the tagline under 80 characters"),
  description: z.string().trim().min(40, "Tell people a bit more (40+ characters)").max(2000),
  logoUrl: optionalUrl,
  categories: z
    .array(z.string())
    .min(1, "Pick at least one category")
    .max(MAX_CATEGORIES, `Pick up to ${MAX_CATEGORIES} categories`),
  pricingModel: z.enum(["free", "freemium", "paid", "open_source", "trial"]),
  twitterUrl: optionalUrl,
  githubUrl: optionalUrl,
  /**
   * In display order, at least one (the homepage cards show the first). Left
   * out (API drafts), the listing's screenshots stay as they are, and it can't
   * be submitted until it has one.
   */
  screenshots: z
    .array(httpUrl)
    .min(1, "Add at least one screenshot")
    .max(MAX_SCREENSHOTS, `Add up to ${MAX_SCREENSHOTS} screenshots`)
    .optional(),
});

export type ProductInput = z.infer<typeof productInput>;

/** Launch tiers, mapped to their SKUs. */
export const TIERS = {
  free: { sku: null, label: "Free", picksWeek: false },
  fast_track: { sku: "launch_fast_track", label: "Fast Track", picksWeek: false },
  pro: { sku: "launch_pro", label: "Pro Debut", picksWeek: true },
  premium: { sku: "launch_premium", label: "Premium Debut", picksWeek: true },
  spotlight: { sku: "launch_spotlight", label: "Spotlight", picksWeek: true },
} as const;

export type Tier = keyof typeof TIERS;

const order: Tier[] = ["free", "fast_track", "pro", "premium", "spotlight"];

export function tierRank(t: Tier): number {
  return order.indexOf(t);
}

export function tierForSku(sku: string): Tier | undefined {
  return order.find((t) => TIERS[t].sku === sku);
}
