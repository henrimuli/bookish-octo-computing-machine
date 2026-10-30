import { env } from "@/env";
import { recordEvent } from "@/lib/newsletter/service";
import { parseEvent, verifySvix } from "@/lib/newsletter/webhook-rules";
import { receiveInbound } from "@/lib/submissions/inbox";
import { receivedEvent } from "@/lib/submissions/inbox-rules";
import { receiveSupport, supportRecipient } from "@/lib/support/service";

/**
 * Resend webhooks, signed with Svix: mail received for the support inbox and
 * per-order submission inboxes, and open/click events for the weekly digest.
 */
export async function POST(request: Request) {
  const secret = env().RESEND_WEBHOOK_SECRET;
  if (!secret) return new Response("Not configured", { status: 404 });
  const raw = await request.text();
  const h = request.headers;
  const id = h.get("svix-id");
  if (!verifySvix({ id, timestamp: h.get("svix-timestamp"), signature: h.get("svix-signature") }, raw, secret)) {
    return new Response("Invalid signature", { status: 401 });
  }
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return new Response("Bad JSON", { status: 400 });
  }
  const received = receivedEvent(payload);
  if (received) {
    // 200 for unknown addresses too: they aren't worth a retry. A failed fetch throws, so Resend retries.
    if (supportRecipient(received.recipients) !== null) {
      const stored = await receiveSupport(received.emailId, received.recipients);
      return Response.json({ stored: Boolean(stored) });
    }
    const stored = await receiveInbound(received.emailId, received.recipients);
    return Response.json({ stored: Boolean(stored) });
  }
  const event = parseEvent(payload);
  if (event) await recordEvent(id!, event);
  return Response.json({ stored: Boolean(event) });
}
