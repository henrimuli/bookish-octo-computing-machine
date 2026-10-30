import "server-only";
import { Resend } from "resend";
import { env } from "@/env";

export type Email = {
  to: string;
  /** Defaults to EMAIL_FROM. */
  from?: string;
  replyTo?: string;
  cc?: string[];
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
  /** Resend tags, echoed back on webhook events (ASCII letters, digits, `_` and `-`). */
  tags?: Array<{ name: string; value: string }>;
};

let client: Resend | undefined;

/** The Resend client, or null in development without a key (production throws instead). */
export function resendClient(): Resend | null {
  const { RESEND_API_KEY, NODE_ENV } = env();
  if (!RESEND_API_KEY) {
    if (NODE_ENV === "production") throw new Error("Missing environment variables: RESEND_API_KEY");
    return null;
  }
  client ??= new Resend(RESEND_API_KEY);
  return client;
}

/** Sends through Resend and returns its email id; without an API key (local dev) it logs the email instead. */
export async function sendEmail(email: Email): Promise<string | null> {
  const r = resendClient();
  if (!r) {
    console.info(`[email] to=${email.to} subject="${email.subject}"\n${email.text}`);
    return null;
  }
  const { data, error } = await r.emails.send({ ...email, from: email.from ?? env().EMAIL_FROM });
  if (error) throw new Error(`Email failed: ${error.message}`);
  return data?.id ?? null;
}

/** Resend accepts at most 100 emails per batch call. */
export const BATCH_SIZE = 100;

/**
 * Sends many emails in batches of 100. `idempotencyKey` makes retries safe:
 * Resend drops a batch it has already accepted under the same key.
 */
export async function sendBatch(emails: Email[], idempotencyKey: string): Promise<number> {
  const r = resendClient();
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
