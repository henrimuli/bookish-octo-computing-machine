import "server-only";
import { env } from "@/env";
import { PaypalProvider } from "./paypal";
import { PaystackProvider } from "./paystack";
import type { PaymentProvider, ProviderId } from "./types";

export * from "./types";
export { SKUS, getSku, isSkuId, formatUsd, type Sku, type SkuId } from "./skus";

const overrides = new Map<ProviderId, PaymentProvider>();
const instances = new Map<ProviderId, PaymentProvider>();

/** Providers with credentials configured, in checkout display order. */
export function enabledProviders(): ProviderId[] {
  const e = env();
  const ids: ProviderId[] = [];
  if (overrides.has("paystack") || e.PAYSTACK_SECRET_KEY) ids.push("paystack");
  if (overrides.has("paypal") || (e.PAYPAL_CLIENT_ID && e.PAYPAL_CLIENT_SECRET)) ids.push("paypal");
  return ids;
}

export function getProvider(id: ProviderId): PaymentProvider {
  const override = overrides.get(id);
  if (override) return override;
  const existing = instances.get(id);
  if (existing) return existing;

  const e = env();
  let provider: PaymentProvider;
  if (id === "paystack") {
    if (!e.PAYSTACK_SECRET_KEY) throw new Error("Missing environment variables: PAYSTACK_SECRET_KEY");
    provider = new PaystackProvider(e.PAYSTACK_SECRET_KEY);
  } else {
    if (!e.PAYPAL_CLIENT_ID || !e.PAYPAL_CLIENT_SECRET) {
      throw new Error("Missing environment variables: PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET");
    }
    provider = new PaypalProvider({
      clientId: e.PAYPAL_CLIENT_ID,
      clientSecret: e.PAYPAL_CLIENT_SECRET,
      webhookId: e.PAYPAL_WEBHOOK_ID,
      environment: e.PAYPAL_ENV,
    });
  }
  instances.set(id, provider);
  return provider;
}

/** Test-only: swap a provider for a fake. Pass null to clear. */
export function setProviderForTests(id: ProviderId, provider: PaymentProvider | null) {
  if (provider) overrides.set(id, provider);
  else overrides.delete(id);
}
