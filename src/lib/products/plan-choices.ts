import "server-only";
import { env } from "@/env";
import { dnsRecordValue } from "@/lib/badges/detect";
import { badgeSnippet } from "@/lib/badges/svg";
import { fastTrackCredit } from "@/lib/billing/service";
import { enabledProviders, formatUsd, getSku } from "@/lib/payments";
import type { ProviderId } from "@/lib/payments/types";
import { TIERS, tierRank, type Tier } from "@/lib/products/input";
import { getEditableProduct } from "@/lib/products/queries";
import { activeFreeCount, badgeRecord, bookableWeeks, MAX_ACTIVE_FREE, nextFreeWeek } from "@/lib/products/service";
import { formatWeekLabel, formatWeekRange, weekKeyFor } from "@/lib/weeks";

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
  /** The badge a free debut needs before it can be submitted. */
  badge: {
    verified: boolean;
    snippets: { light: string; dark: string };
    previewUrls: { light: string; dark: string };
    dnsHost: string;
    dnsValue: string;
  };
};

/** Every paid tier's first perk: no queue, and no waiting for Monday. */
const INSTANT = "Instant debut: live as soon as it's approved, no queue";

const perks: Record<Tier, string[]> = {
  free: [
    "Debuts on a Monday, in the next week with a free slot",
    "Needs our badge on your site, checked before you submit",
    "Dofollow link while the badge stays up",
    "Top 3 of the week keep the link for good",
  ],
  fast_track: [INSTANT, "7 days featured on the homepage", "No badge required", "Guaranteed dofollow link"],
  pro: [
    INSTANT,
    "Or pick a later debut week",
    "14 days featured on the homepage",
    "Weekly newsletter inclusion",
    "Guaranteed dofollow link",
  ],
  premium: [
    INSTANT,
    "Everything in Pro",
    "30 days featured on the homepage",
    "Social posts on X, LinkedIn and Bluesky",
    "Written launch post on our blog",
  ],
  spotlight: [
    INSTANT,
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

  const [freeWeek, activeFree, credit, badge] = await Promise.all([
    nextFreeWeek(),
    activeFreeCount(userId, p.id),
    fastTrackCredit(userId),
    badgeRecord(p.id),
  ]);
  const siteUrl = env().NEXT_PUBLIC_SITE_URL;
  const freeAvailable =
    (p.status === "draft" || p.status === "rejected") && p.tier === "free" && activeFree < MAX_ACTIVE_FREE;
  const thisWeek = weekKeyFor(new Date());

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
            ? `Free debuts go live on Mondays. Yours: ${formatWeekLabel(freeWeek)} (${formatWeekRange(freeWeek)}), after review`
            : p.tier !== "free"
              ? "You already have a paid debut"
              : activeFree >= MAX_ACTIVE_FREE
                ? `You have ${MAX_ACTIVE_FREE} free debuts waiting already`
                : "Already submitted"
          : "Goes live the moment it's approved (usually within 24 hours) and joins this week's board",
    };
  });

  return {
    productId: p.id,
    productName: p.name,
    status: p.status,
    options,
    weeks: bookableWeeks().map((k) => ({
      key: k,
      label:
        k === thisWeek
          ? "Now: live as soon as it's approved, on this week's board"
          : `${formatWeekLabel(k)} · ${formatWeekRange(k)}`,
    })),
    providers: enabledProviders(),
    freeFastTrack: credit.eligible ? credit.available : null,
    badge: {
      verified: badge?.status === "verified",
      snippets: {
        light: badgeSnippet({ siteUrl, slug: p.slug, theme: "light" }),
        dark: badgeSnippet({ siteUrl, slug: p.slug, theme: "dark" }),
      },
      previewUrls: { light: `/badge/${p.slug}?theme=light`, dark: `/badge/${p.slug}?theme=dark` },
      dnsHost: p.domain,
      dnsValue: dnsRecordValue(badge?.dnsToken ?? ""),
    },
  };
}
