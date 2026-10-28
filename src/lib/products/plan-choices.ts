import "server-only";
import { fastTrackCredit } from "@/lib/billing/service";
import { enabledProviders, formatUsd, getSku } from "@/lib/payments";
import type { ProviderId } from "@/lib/payments/types";
import { TIERS, tierRank, type Tier } from "@/lib/products/input";
import { getEditableProduct } from "@/lib/products/queries";
import { activeFreeCount, bookableWeeks, MAX_ACTIVE_FREE, nextFreeWeek } from "@/lib/products/service";
import { formatWeekLabel, formatWeekRange, upcomingWeekKeys } from "@/lib/weeks";

export type PlanOption = {
  tier: Tier;
  label: string;
  price: string;
  perks: string[];
  picksWeek: boolean;
  available: boolean;
  note?: string;
};

/** Everything the plan step needs, for the plan page and the debut modal. */
export type PlanChoices = {
  productId: string;
  productName: string;
  status: string;
  options: PlanOption[];
  weeks: Array<{ key: string; label: string }>;
  providers: ProviderId[];
  /** Maker Pro: true when this quarter's free Fast Track is unused, false when used, null without Pro. */
  freeFastTrack: boolean | null;
};

const perks: Record<Tier, string[]> = {
  free: [
    "Next week with a free slot",
    "Dofollow link while our badge is on your site",
    "Top 3 of the week keep the link for good",
  ],
  fast_track: ["Debut next week, no queue", "No badge required", "Guaranteed dofollow link"],
  pro: [
    "Pick your debut week",
    "7 days featured on the homepage",
    "Weekly newsletter inclusion",
    "Guaranteed dofollow link",
  ],
  premium: [
    "Everything in Pro",
    "30 days featured",
    "Social posts on X, LinkedIn and Bluesky",
    "Written launch post on our blog",
  ],
  spotlight: [
    "Everything in Premium",
    "Homepage hero for your debut week (3 spots a week)",
    "Top newsletter slot",
    "Bundled: submission to 40 directories",
  ],
};

/** The maker's plan options for one of their listings, or null if it isn't theirs. */
export async function planChoices(userId: string, productId: string): Promise<PlanChoices | null> {
  const editable = /^[0-9a-f-]{36}$/.test(productId) ? await getEditableProduct(productId, userId) : null;
  if (!editable) return null;
  const p = editable.product;

  const [freeWeek, activeFree, credit] = await Promise.all([
    nextFreeWeek(),
    activeFreeCount(userId, p.id),
    fastTrackCredit(userId),
  ]);
  const freeAvailable =
    (p.status === "draft" || p.status === "rejected") && p.tier === "free" && activeFree < MAX_ACTIVE_FREE;
  const nextWeek = upcomingWeekKeys(new Date(), 1)[0];

  const options: PlanOption[] = (Object.keys(TIERS) as Tier[]).map((tier) => {
    const sku = TIERS[tier].sku ? getSku(TIERS[tier].sku!) : undefined;
    const available = tier === "free" ? freeAvailable : tierRank(tier) > tierRank(p.tier);
    return {
      tier,
      label: TIERS[tier].label,
      price: sku ? formatUsd(sku.amountCents) : "$0",
      perks: perks[tier],
      picksWeek: TIERS[tier].picksWeek,
      available,
      note:
        tier === "free"
          ? freeAvailable
            ? `Estimated debut: ${formatWeekLabel(freeWeek)} (${formatWeekRange(freeWeek)}), after review`
            : p.tier !== "free"
              ? "You already have a paid debut"
              : activeFree >= MAX_ACTIVE_FREE
                ? `You have ${MAX_ACTIVE_FREE} free debuts waiting already`
                : "Already submitted"
          : tier === "fast_track"
            ? `Debuts ${formatWeekLabel(nextWeek)} (${formatWeekRange(nextWeek)}), after review`
            : undefined,
    };
  });

  return {
    productId: p.id,
    productName: p.name,
    status: p.status,
    options,
    weeks: bookableWeeks().map((k) => ({ key: k, label: `${formatWeekLabel(k)} · ${formatWeekRange(k)}` })),
    providers: enabledProviders(),
    freeFastTrack: credit.eligible ? credit.available : null,
  };
}
