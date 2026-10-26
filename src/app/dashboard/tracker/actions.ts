"use server";

import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { recheckTracker, TrackerError, trackerUpdate, updateTracker } from "@/lib/directories/tracker";

type Row = Awaited<ReturnType<typeof updateTracker>>;
type Result = { ok: true; row: Row } | { ok: false; error: string };

export async function updateTrackerAction(input: z.input<typeof trackerUpdate>): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in first." };
  try {
    return { ok: true, row: await updateTracker(user.id, input) };
  } catch (err) {
    if (err instanceof TrackerError) return { ok: false, error: err.message };
    if (err instanceof z.ZodError) return { ok: false, error: err.issues[0]?.message ?? "Check the details." };
    throw err;
  }
}

export async function recheckAction(submissionId: string): Promise<Result> {
  const user = await getCurrentUser();
  if (!user || !z.string().uuid().safeParse(submissionId).success) return { ok: false, error: "Not found." };
  try {
    const row = await recheckTracker(user.id, submissionId);
    return row ? { ok: true, row } : { ok: false, error: "Nothing to check." };
  } catch (err) {
    if (err instanceof TrackerError) return { ok: false, error: err.message };
    throw err;
  }
}
