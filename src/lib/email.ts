import "server-only";
import { Resend } from "resend";
import { env } from "@/env";

export type Email = { to: string; subject: string; html: string; text: string };

let client: Resend | undefined;

/** Sends through Resend; without an API key (local dev) it logs the email instead. */
export async function sendEmail(email: Email): Promise<void> {
  const { RESEND_API_KEY, EMAIL_FROM, NODE_ENV } = env();
  if (!RESEND_API_KEY) {
    if (NODE_ENV === "production") throw new Error("Missing environment variables: RESEND_API_KEY");
    console.info(`[email] to=${email.to} subject="${email.subject}"\n${email.text}`);
    return;
  }
  client ??= new Resend(RESEND_API_KEY);
  const { error } = await client.emails.send({ from: EMAIL_FROM, ...email });
  if (error) throw new Error(`Email failed: ${error.message}`);
}
