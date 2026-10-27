import { env } from "@/env";
import { recordEvent } from "@/lib/newsletter/service";
import { parseEvent, verifySvix } from "@/lib/newsletter/webhook-rules";

/** Resend open/click events for the weekly digest, signed with Svix. */
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
  const event = parseEvent(payload);
  if (event) await recordEvent(id!, event);
  return Response.json({ stored: Boolean(event) });
}
