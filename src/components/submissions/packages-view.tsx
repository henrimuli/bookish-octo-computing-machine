import { and, eq } from "drizzle-orm";
import { BuyButton } from "@/components/buy-button";
import { Card } from "@/components/ui/primitives";
import { db, schema } from "@/db";
import { getCurrentUser } from "@/lib/auth";
import { enabledProviders } from "@/lib/payments";
import { formatUsd, getSku } from "@/lib/payments/skus";
import { PACKAGES } from "@/lib/submissions/packages";

/*
 * The submission service's how-it-works, packages and notes. Shared by the
 * public page (/submission-service) and the dashboard (/dashboard/orders/new).
 */

const STEPS = [
  ["Pay, no account needed", "Checkout takes a minute. You get a private link by email."],
  [
    "Tell us about your product",
    "Logo, three description lengths, categories and whether badges are OK. About five minutes.",
  ],
  ["We submit by hand", "Starts within 48 hours. Rejected directories are replaced, so the count holds."],
  ["We verify every link", "Each live listing is fetched and checked: does it load, link to you, and is it dofollow."],
];

export function ServiceSteps() {
  return (
    <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {STEPS.map(([t, d], i) => (
        <li key={t}>
          <Card className="h-full p-5">
            <p className="font-display text-2xl font-bold text-primary">{i + 1}</p>
            <p className="mt-1 font-medium">{t}</p>
            <p className="mt-1 text-sm text-muted-foreground">{d}</p>
          </Card>
        </li>
      ))}
    </ol>
  );
}

export function ServiceNotes() {
  return (
    <div className="mt-12 grid gap-4 text-sm sm:grid-cols-2">
      <Card className="p-5">
        <p className="font-medium">Badges: your call</p>
        <p className="mt-1 text-muted-foreground">
          By default we skip directories that ask for a badge. If you allow them, you paste one HTML block into your
          footer once and we check it&apos;s there before submitting.
        </p>
      </Card>
      <Card className="p-5">
        <p className="font-medium">Accounts and logins</p>
        <p className="mt-1 text-muted-foreground">
          Most directories need an account. We create them in your product&apos;s name and hand over the logins when we
          deliver. Product Hunt, Hacker News and review sites need you personally, so you get a checklist for those
          instead.
        </p>
      </Card>
    </div>
  );
}

/**
 * The three packages with their buy buttons. `product` (a listing id from the
 * query string) starts the order from one of the buyer's listings; `returnTo`
 * "dashboard" brings the buyer back into the dashboard after checkout.
 */
export async function PackageCards({ product, returnTo }: { product?: string; returnTo?: "dashboard" }) {
  const user = await getCurrentUser().catch(() => null);
  const boost =
    user && typeof product === "string" && /^[0-9a-f-]{36}$/.test(product)
      ? await db().query.products.findFirst({
          where: and(eq(schema.products.id, product), eq(schema.products.createdBy, user.id)),
          columns: { id: true, name: true },
        })
      : null;
  const providers = enabledProviders();
  return (
    <section className="mt-12">
      {boost && (
        <p className="mb-4 rounded-md bg-primary/10 p-3 text-sm text-primary">
          Boosting <strong>{boost.name}</strong>: we&apos;ll start your order with its details filled in.
        </p>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        {(Object.entries(PACKAGES) as Array<[keyof typeof PACKAGES, (typeof PACKAGES)[keyof typeof PACKAGES]]>).map(
          ([id, p]) => {
            const sku = getSku(p.sku)!;
            return (
              <Card key={id} className={`flex flex-col p-6 ${id === "growth" ? "border-primary" : ""}`}>
                <p className="font-medium">
                  {p.label} {id === "growth" && <span className="text-xs text-primary">· most popular</span>}
                </p>
                <p className="mt-1 font-display text-4xl font-bold">{formatUsd(sku.amountCents)}</p>
                <p className="mt-1 text-sm">
                  {p.count} directories · done in {p.days} days
                </p>
                <p className="mt-2 flex-1 text-sm text-muted-foreground">{sku.description}</p>
                <BuyButton
                  sku={sku.id}
                  recurring={false}
                  providers={providers}
                  productId={boost?.id}
                  returnTo={returnTo}
                  className="mt-6"
                />
              </Card>
            );
          },
        )}
      </div>
    </section>
  );
}
