"use server";

import { z } from "zod";
import type { Prefill } from "@/lib/products/prefill";
import { prefillFromSite } from "@/lib/products/prefill-service";
import { orderByIntakeToken, submitIntake, SubmissionError, type IntakeInput } from "@/lib/submissions/service";

/** Fills the intake form from the client's website. The private order link is the credential. */
export async function intakePrefillAction(
  token: string,
  url: string,
): Promise<{ ok: true; data: Prefill } | { ok: false; error: string }> {
  const order = await orderByIntakeToken(token);
  if (!order || order.status !== "awaiting_intake") return { ok: false, error: "Order not found." };
  // The order is the caller, so one order link can't run up drafts.
  return prefillFromSite(url, { userId: null, clientKey: `order:${order.id}`, source: "web" });
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
