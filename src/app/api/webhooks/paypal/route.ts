import { enabledProviders, WebhookSignatureError } from "@/lib/payments";
import { handleWebhook } from "@/lib/payments/service";

export async function POST(request: Request) {
  if (!enabledProviders().includes("paypal")) return new Response("Not configured", { status: 404 });
  const raw = await request.text();
  try {
    await handleWebhook("paypal", raw, request.headers);
    return new Response(null, { status: 200 });
  } catch (err) {
    if (err instanceof WebhookSignatureError) return new Response("Invalid signature", { status: 401 });
    console.error("paypal webhook failed", err);
    // Non-2xx makes PayPal retry.
    return new Response("Error", { status: 500 });
  }
}
