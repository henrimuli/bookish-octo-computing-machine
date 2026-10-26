"use server";

import { refresh } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { getCurrentUser, isStaff } from "@/lib/auth";
import {
  assignOrder,
  bulkUpdate,
  deliverOrder,
  sendBadgeBlock,
  SubmissionError,
  updateOrderSubmission,
  type OpsUpdate,
} from "@/lib/submissions/service";

type Result = { ok: true; message?: string } | { ok: false; error: string };
const uuid = z.string().uuid();

async function staffOnly() {
  const user = await getCurrentUser();
  return user && isStaff(user) ? user : null;
}

async function run(fn: () => Promise<string | void>): Promise<Result> {
  if (!(await staffOnly())) return { ok: false, error: "Not allowed." };
  try {
    const message = await fn();
    refresh();
    return { ok: true, message: message || undefined };
  } catch (err) {
    if (err instanceof SubmissionError) return { ok: false, error: err.message };
    if (err instanceof z.ZodError) return { ok: false, error: err.issues[0]?.message ?? "Check the input." };
    throw err;
  }
}

export async function updateRowAction(submissionId: string, input: OpsUpdate) {
  if (!uuid.safeParse(submissionId).success) return { ok: false as const, error: "Not found." };
  return run(async () => {
    const { row, replacement } = await updateOrderSubmission(submissionId, input);
    if (replacement) return "Replaced with the next best directory.";
    if (row.status === "live" && row.linkVerdict) return `Link check: ${row.linkVerdict}.`;
  });
}

export async function bulkAction(orderId: string, ids: string[], status: "submitted" | "pending" | "skipped" | "todo") {
  if (!uuid.safeParse(orderId).success || !z.array(uuid).max(500).safeParse(ids).success) {
    return { ok: false as const, error: "Bad request." };
  }
  return run(async () => `${await bulkUpdate(orderId, ids, status)} updated.`);
}

export async function assignAction(orderId: string, assigneeId: string | null) {
  if (!uuid.safeParse(orderId).success) return { ok: false as const, error: "Not found." };
  return run(() => assignOrder(orderId, assigneeId || null));
}

export async function resendBadgeBlockAction(orderId: string) {
  if (!uuid.safeParse(orderId).success) return { ok: false as const, error: "Not found." };
  return run(async () => {
    const order = await db().query.submissionOrders.findFirst({ where: eq(schema.submissionOrders.id, orderId) });
    if (!order) throw new SubmissionError("Not found.");
    return (await sendBadgeBlock(order))
      ? "Badge block sent."
      : "No badge snippets yet: add them to the badge directories first.";
  });
}

export async function deliverAction(orderId: string) {
  if (!uuid.safeParse(orderId).success) return { ok: false as const, error: "Not found." };
  return run(async () => {
    await deliverOrder(orderId);
    return "Delivered. The client has their report.";
  });
}
