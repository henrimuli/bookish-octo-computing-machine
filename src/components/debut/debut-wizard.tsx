"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { debutSetupAction, orderStatusAction, planChoicesAction } from "@/app/submit/actions";
import { PlanPicker } from "@/components/plan-picker";
import { ProductForm } from "@/components/product-form";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/primitives";
import { CHECKOUT_CHANNEL, type CheckoutMessage } from "@/lib/checkout-channel";
import type { PlanChoices } from "@/lib/products/plan-choices";
import { cn } from "@/lib/utils";

type Setup = {
  categories: Array<{ slug: string; name: string }>;
  uploadsEnabled: boolean;
  screenshotsEnabled: boolean;
};
type Checkout = { orderId: string; url: string; tab: Window | null };
type Step = "details" | "plan" | "payment" | "done";

const STEPS: Array<{ id: Step; label: string }> = [
  { id: "details", label: "Details" },
  { id: "plan", label: "Plan" },
  { id: "payment", label: "Payment" },
  { id: "done", label: "Done" },
];

/** The submission flow as a wide modal: details, plan, payment (in a new tab), then done. */
export function DebutWizard({ initialUrl, onClose }: { initialUrl: string | null; onClose: () => void }) {
  const router = useRouter();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [setupError, setSetupError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("details");
  const [productId, setProductId] = useState<string | undefined>();
  const [choices, setChoices] = useState<PlanChoices | null>(null);
  const [loadingPlans, startPlans] = useTransition();
  const [planError, setPlanError] = useState<string | null>(null);
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    let live = true;
    void debutSetupAction().then((res) => {
      if (!live) return;
      if (res.ok) setSetup(res.data);
      else setSetupError(res.error);
    });
    return () => {
      live = false;
    };
  }, []);

  function toPlan(id: string) {
    setProductId(id);
    setPlanError(null);
    startPlans(async () => {
      const res = await planChoicesAction(id);
      if (!res.ok) return setPlanError(res.error);
      setChoices(res.data);
      setStep("plan");
    });
  }

  const finish = (wasPaid: boolean) => {
    setPaid(wasPaid);
    setStep("done");
    router.refresh();
  };

  const wide = step === "details" || step === "plan";
  const visibleSteps = STEPS.filter((s) => s.id !== "payment" || checkout);

  return (
    <Dialog
      onClose={onClose}
      size={wide ? "xl" : "md"}
      label="Debut your product"
      // Wide steps keep one height and scroll inside, so a long form doesn't stretch the modal.
      className={cn(
        "flex flex-col overflow-hidden",
        wide && "h-[calc(100dvh-1.5rem)] sm:h-[min(46rem,calc(100dvh-3rem))]",
      )}
    >
      <div className="shrink-0 border-b border-border px-6 pb-4 pr-12 pt-6 sm:px-8">
        <h2 className="font-display text-2xl font-bold tracking-tight">Debut your product</h2>
        {step === "details" && (
          <p className="mt-1 text-sm text-muted-foreground">Paste your URL and we&apos;ll fill in what we can.</p>
        )}
        {step === "plan" && (
          <p className="mt-1 text-sm text-muted-foreground">
            Pick a free or paid debut. Every paid debut is covered by our money-back guarantee.
          </p>
        )}
        <ol className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-2 text-xs">
          {visibleSteps.map((s, i) => {
            const current = visibleSteps.findIndex((v) => v.id === step);
            return (
              <li key={s.id} className="flex items-center gap-2">
                {i > 0 && <span className="h-px w-4 bg-border sm:w-6" />}
                <span
                  className={cn(
                    "flex items-center gap-1.5",
                    i === current ? "font-medium text-foreground" : "text-muted-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-5 place-items-center rounded-full text-[10px] font-semibold",
                      i < current
                        ? "bg-primary text-primary-foreground"
                        : i === current
                          ? "bg-primary/15 text-primary ring-1 ring-primary"
                          : "bg-muted",
                    )}
                  >
                    {i < current ? "✓" : i + 1}
                  </span>
                  {s.label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-8">
        {setupError ? (
          <p className="text-sm text-danger">{setupError}</p>
        ) : !setup ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Spinner /> Loading…
          </div>
        ) : (
          <>
            {/* Kept mounted so going back to details keeps what the maker typed. */}
            <div className={step === "details" ? "" : "hidden"}>
              <ProductForm
                layout="modal"
                categories={setup.categories}
                uploadsEnabled={setup.uploadsEnabled}
                screenshotsEnabled={setup.screenshotsEnabled}
                initialWebsiteUrl={initialUrl && /^https?:\/\//.test(initialUrl) ? initialUrl : undefined}
                productId={productId}
                onSaved={toPlan}
                status={planError ? { text: planError, error: true } : loadingPlans ? { text: "Loading plans…" } : null}
              />
            </div>

            {step === "plan" && choices && (
              <PlanPicker
                {...choices}
                onEditDetails={() => setStep("details")}
                onSubmitted={() => finish(false)}
                onCheckout={(c) => {
                  setCheckout(c);
                  setStep("payment");
                }}
              />
            )}

            {step === "payment" && checkout && (
              <PaymentTracker
                checkout={checkout}
                onPaid={() => finish(true)}
                onBack={() => {
                  setCheckout(null);
                  if (productId) toPlan(productId);
                }}
              />
            )}

            {step === "done" && (
              <div className="py-4 text-center">
                <div className="mx-auto grid size-14 place-items-center rounded-full bg-success/15 text-2xl text-success">
                  ✓
                </div>
                <h3 className="mt-4 font-display text-xl font-semibold">
                  {paid ? "Payment received. You're in!" : "Submitted for review"}
                </h3>
                <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                  We review new listings within 24 hours and will email you when your debut is scheduled. Track it from
                  your dashboard.
                </p>
                <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
                  <Button onClick={() => router.push(`/dashboard?submitted=${productId}`)}>Go to dashboard</Button>
                  <Button variant="outline" onClick={onClose}>
                    Close
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Dialog>
  );
}

/**
 * Waits for the checkout happening in another tab. The return page posts on
 * CHECKOUT_CHANNEL when the provider sends the buyer back; polling covers
 * browsers without BroadcastChannel and buyers who close that tab early.
 */
function PaymentTracker({ checkout, onPaid, onBack }: { checkout: Checkout; onPaid: () => void; onBack: () => void }) {
  const [state, setState] = useState<{ kind: "waiting" } | { kind: "failed"; reason: string } | { kind: "cancelled" }>({
    kind: "waiting",
  });
  const onPaidRef = useRef(onPaid);
  useEffect(() => {
    onPaidRef.current = onPaid;
  });

  const check = useCallback(async () => {
    const res = await orderStatusAction(checkout.orderId);
    if (!res.ok) return;
    if (res.data.status === "paid") onPaidRef.current();
    else if (res.data.status === "failed" || res.data.status === "refunded")
      setState({
        kind: "failed",
        reason: res.data.reason ?? "Your payment didn't go through. You haven't been charged.",
      });
  }, [checkout.orderId]);

  useEffect(() => {
    if (state.kind !== "waiting") return;
    const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(CHECKOUT_CHANNEL);
    if (channel) {
      channel.onmessage = (e: MessageEvent<CheckoutMessage>) => {
        if (e.data?.orderId !== checkout.orderId) return;
        if (e.data.status === "cancelled") setState({ kind: "cancelled" });
        else void check();
      };
    }
    const poll = setInterval(() => void check(), 4000);
    const onVisible = () => document.visibilityState === "visible" && void check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      channel?.close();
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [check, checkout.orderId, state.kind]);

  if (state.kind !== "waiting") {
    return (
      <div className="py-4 text-center">
        <div className="mx-auto grid size-14 place-items-center rounded-full bg-danger/15 text-2xl text-danger">!</div>
        <h3 className="mt-4 font-display text-xl font-semibold">
          {state.kind === "cancelled" ? "Checkout cancelled" : "Payment didn't go through"}
        </h3>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
          {state.kind === "cancelled" ? "No payment was taken. Your listing is saved as a draft." : state.reason}
        </p>
        <Button className="mt-6" onClick={onBack}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <div className="py-4 text-center">
      <Spinner className="mx-auto size-8 text-primary" />
      <h3 className="mt-4 font-display text-xl font-semibold">Waiting for your payment</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        Finish checkout in the new tab. This updates on its own once the payment is confirmed.
      </p>
      <div className="mt-6 flex flex-col items-center gap-2">
        <a
          href={checkout.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-primary hover:underline"
        >
          {checkout.tab ? "Reopen checkout" : "Open checkout"} ↗
        </a>
        <button type="button" onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground">
          Choose a different plan
        </button>
      </div>
    </div>
  );
}
