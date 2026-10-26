"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { startTierCheckoutAction, submitFreeAction } from "@/app/submit/actions";
import { Button } from "@/components/ui/button";
import { Badge, Card, Input } from "@/components/ui/primitives";
import type { Tier } from "@/lib/products/input";
import type { ProviderId } from "@/lib/payments/types";
import { cn } from "@/lib/utils";

export type PlanOption = {
  tier: Tier;
  label: string;
  price: string;
  perks: string[];
  picksWeek: boolean;
  available: boolean;
  note?: string;
};

const providerLabels: Record<ProviderId, string> = { paystack: "Pay with card", paypal: "PayPal" };

export function PlanPicker({
  productId,
  productName,
  status,
  options,
  weeks,
  providers,
}: {
  productId: string;
  productName: string;
  status: string;
  options: PlanOption[];
  weeks: Array<{ key: string; label: string }>;
  providers: ProviderId[];
}) {
  const firstAvailable = options.find((o) => o.available)?.tier ?? "pro";
  const [selected, setSelected] = useState<Tier>(firstAvailable);
  const [week, setWeek] = useState(weeks[0]?.key ?? "");
  const [coupon, setCoupon] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const option = options.find((o) => o.tier === selected)!;

  function submitFree() {
    setError(null);
    start(async () => {
      const res = await submitFreeAction(productId);
      if (res && !res.ok) setError(res.error);
    });
  }

  function pay(provider: ProviderId) {
    setError(null);
    start(async () => {
      const res = await startTierCheckoutAction({
        productId,
        tier: selected as Exclude<Tier, "free">,
        provider,
        weekKey: option.picksWeek ? week : undefined,
        coupon: coupon || undefined,
      });
      if (!res.ok) return setError(res.error);
      window.location.assign(res.data.url);
    });
  }

  return (
    <div className="mt-8 space-y-8">
      <p className="text-sm text-muted-foreground">
        Listing: <span className="font-medium text-foreground">{productName}</span>{" "}
        <Link href={`/submit/${productId}`} className="text-primary hover:underline">
          Edit details
        </Link>
        {status === "pending" && <Badge className="ml-2">In review</Badge>}
      </p>

      <div className="grid gap-4 md:grid-cols-5">
        {options.map((o) => (
          <button
            key={o.tier}
            type="button"
            disabled={!o.available}
            onClick={() => setSelected(o.tier)}
            className={cn(
              "flex flex-col rounded-lg border bg-card p-4 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
              selected === o.tier
                ? "border-primary ring-2 ring-primary/30"
                : "border-border hover:border-foreground/30",
            )}
          >
            <span className="font-medium">{o.label}</span>
            <span className="mt-1 font-display text-2xl font-bold">{o.price}</span>
            <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
              {o.perks.map((perk) => (
                <li key={perk}>• {perk}</li>
              ))}
            </ul>
          </button>
        ))}
      </div>

      <Card className="space-y-4">
        <h2 className="font-display text-lg font-semibold">
          {option.label} · {option.price}
        </h2>
        {option.note && <p className="text-sm text-muted-foreground">{option.note}</p>}

        {option.picksWeek && (
          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Debut week</span>
            <select
              className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm"
              value={week}
              onChange={(e) => setWeek(e.target.value)}
            >
              {weeks.map((w) => (
                <option key={w.key} value={w.key}>
                  {w.label}
                </option>
              ))}
            </select>
          </label>
        )}

        {selected === "free" ? (
          <Button onClick={submitFree} disabled={pending || !option.available}>
            {pending ? "Submitting…" : "Submit for review"}
          </Button>
        ) : providers.length === 0 ? (
          <Button disabled variant="outline">
            Payments opening soon
          </Button>
        ) : (
          <div className="space-y-3">
            <Input
              placeholder="Coupon (optional)"
              value={coupon}
              onChange={(e) => setCoupon(e.target.value)}
              className="max-w-xs"
            />
            <div className="flex flex-wrap gap-2">
              {providers.map((p) => (
                <Button
                  key={p}
                  variant={p === "paystack" ? "primary" : "outline"}
                  disabled={pending || !option.available}
                  onClick={() => pay(p)}
                >
                  {pending ? "Redirecting…" : providerLabels[p]}
                </Button>
              ))}
            </div>
          </div>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
      </Card>
    </div>
  );
}
