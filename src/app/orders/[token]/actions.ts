"use server";

import { z } from "zod";
import { safeFetchText, UnsafeUrlError } from "@/lib/net";
import { extractPrefill, type Prefill } from "@/lib/products/prefill";
import { orderByIntakeToken, submitIntake, SubmissionError, type IntakeInput } from "@/lib/submissions/service";

/** Fills the intake form from the client's website. The private order link is the credential. */
export async function intakePrefillAction(
  token: string,
  url: string,
): Promise<{ ok: true; data: Prefill } | { ok: false; error: string }> {
  const order = await orderByIntakeToken(token);
  if (!order || order.status !== "awaiting_intake") return { ok: false, error: "Order not found." };
  const normalized = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
  try {
    const page = await safeFetchText(normalized, { timeoutMs: 8000 });
    if (page.status >= 400) return { ok: false, error: `Your site returned HTTP ${page.status}.` };
    return { ok: true, data: extractPrefill(page.body, page.url) };
  } catch (err) {
    if (err instanceof UnsafeUrlError) return { ok: false, error: err.message };
    return { ok: false, error: "We couldn't reach that site. Fill the details in by hand." };
  }
}

export async function submitIntakeAction(
  token: string,
  input: IntakeInput,
): Promise<{ ok: true } | { ok: false; error: string; field?: string }> {
  try {
    await submitIntake(token, input);
    return { ok: true };
  } catch (err) {
    if (err instanceof SubmissionError) return { ok: false, error: err.message };
    if (err instanceof z.ZodError) {
      const i = err.issues[0];
      return { ok: false, error: i?.message ?? "Check the form.", field: i?.path[0]?.toString() };
    }
    throw err;
  }
}
