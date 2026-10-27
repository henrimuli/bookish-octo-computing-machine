import { ZodError } from "zod";
import { env } from "@/env";
import { receiveInbound } from "@/lib/submissions/inbox";
import { verifyInbound } from "@/lib/submissions/inbox-rules";

/**
 * Inbound mail for per-order submission inboxes, posted by the email worker
 * (workers/inbound-email) as JSON { to, from, subject, text, html }, signed
 * with X-Inbound-Timestamp and X-Inbound-Signature (HMAC-SHA256 of "ts.body").
 */
export async function POST(request: Request) {
  const secret = env().INBOUND_SECRET;
  if (!secret) return new Response("Inbound mail isn't configured", { status: 503 });
  const body = await request.text();
  const signed = verifyInbound(
    body,
    request.headers.get("x-inbound-timestamp"),
    request.headers.get("x-inbound-signature"),
    secret,
  );
  if (body.length > 2_000_000 || !signed) return new Response("Unauthorized", { status: 401 });
  try {
    const stored = await receiveInbound(JSON.parse(body));
    // 200 either way: an unknown address isn't worth a retry.
    return Response.json({ stored: Boolean(stored) });
  } catch (err) {
    if (err instanceof SyntaxError || err instanceof ZodError) return new Response("Bad request", { status: 400 });
    throw err;
  }
}
