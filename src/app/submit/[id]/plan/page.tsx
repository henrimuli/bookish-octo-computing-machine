import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PlanPicker, type PlanOption } from "@/components/plan-picker";
import { Container, Heading } from "@/components/ui/primitives";
import { requireUser } from "@/lib/auth";
import { fastTrackCredit } from "@/lib/billing/service";
import { enabledProviders, formatUsd, getSku } from "@/lib/payments";
import { TIERS, tierRank, type Tier } from "@/lib/products/input";
import { getEditableProduct } from "@/lib/products/queries";
import { activeFreeCount, bookableWeeks, MAX_ACTIVE_FREE, nextFreeWeek } from "@/lib/products/service";
import { formatWeekLabel, formatWeekRange, upcomingWeekKeys } from "@/lib/weeks";

export const metadata: Metadata = { title: "Choose your debut", robots: { index: false } };

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

export default function PlanPage(props: PageProps<"/submit/[id]/plan">) {
  return (
    <Container className="max-w-5xl py-12">
      <Heading>Choose your debut</Heading>
      <p className="mt-2 text-muted-foreground">
        Every paid debut is covered by our{" "}
        <Link href="/refund-policy" className="text-primary hover:underline">
          money-back guarantee
        </Link>
        .
      </p>
      <Suspense fallback={<p className="mt-8 text-muted-foreground">Loading…</p>}>
        <Plans params={props.params} />
      </Suspense>
    </Container>
  );
}

async function Plans({ params }: { params: PageProps<"/submit/[id]/plan">["params"] }) {
  const { id } = await params;
  const user = await requireUser(`/submit/${id}/plan`);
  const editable = /^[0-9a-f-]{36}$/.test(id) ? await getEditableProduct(id, user.id) : null;
  if (!editable) notFound();
  const p = editable.product;

  const [freeWeek, activeFree, credit] = await Promise.all([
    nextFreeWeek(),
    activeFreeCount(user.id, p.id),
    fastTrackCredit(user.id),
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

  return (
    <PlanPicker
      productId={p.id}
      productName={p.name}
      status={p.status}
      options={options}
      weeks={bookableWeeks().map((k) => ({ key: k, label: `${formatWeekLabel(k)} · ${formatWeekRange(k)}` }))}
      providers={enabledProviders()}
      freeFastTrack={credit.eligible ? credit.available : null}
    />
  );
}
