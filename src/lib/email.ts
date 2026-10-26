import "server-only";
import { Resend } from "resend";
import { env } from "@/env";

export type Email = { to: string; subject: string; html: string; text: string; headers?: Record<string, string> };

let client: Resend | undefined;

function resend(): Resend | null {
  const { RESEND_API_KEY, NODE_ENV } = env();
  if (!RESEND_API_KEY) {
    if (NODE_ENV === "production") throw new Error("Missing environment variables: RESEND_API_KEY");
    return null;
  }
  client ??= new Resend(RESEND_API_KEY);
  return client;
}

/** Sends through Resend; without an API key (local dev) it logs the email instead. */
export async function sendEmail(email: Email): Promise<void> {
  const r = resend();
  if (!r) {
    console.info(`[email] to=${email.to} subject="${email.subject}"\n${email.text}`);
    return;
  }
  const { error } = await r.emails.send({ from: env().EMAIL_FROM, ...email });
  if (error) throw new Error(`Email failed: ${error.message}`);
}

/** Resend accepts at most 100 emails per batch call. */
export const BATCH_SIZE = 100;

/**
 * Sends many emails in batches of 100. `idempotencyKey` makes retries safe:
 * Resend drops a batch it has already accepted under the same key.
 */
export async function sendBatch(emails: Email[], idempotencyKey: string): Promise<number> {
  const r = resend();
  if (!r) {
    console.info(`[email] batch "${emails[0]?.subject ?? ""}" to ${emails.length} recipients (logged, not sent)`);
    return emails.length;
  }
  let sent = 0;
  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const chunk = emails.slice(i, i + BATCH_SIZE).map((e) => ({ from: env().EMAIL_FROM, ...e }));
    const { error } = await r.batch.send(chunk, { idempotencyKey: `${idempotencyKey}-${i / BATCH_SIZE}` });
    if (error) throw new Error(`Batch email failed after ${sent} sent: ${error.message}`);
    sent += chunk.length;
  }
  return sent;
}
