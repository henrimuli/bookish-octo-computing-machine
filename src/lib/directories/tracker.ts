import "server-only";
import { and, asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";
import { verifySubmission } from "./verify";

const { directories, submissions, products } = schema;

export class TrackerError extends Error {}

export const TRACKER_STATUSES = ["todo", "submitted", "pending", "live", "rejected", "skipped"] as const;
export type TrackerStatus = (typeof TRACKER_STATUSES)[number];

async function ownedProduct(userId: string, productId: string) {
  const p = await db().query.products.findFirst({
    where: and(eq(products.id, productId), eq(products.createdBy, userId)),
    columns: { id: true, name: true, domain: true },
  });
  if (!p) throw new TrackerError("That isn't one of your products.");
  return p;
}

/** Every active directory with this product's tracker row, if any. */
export async function trackerRows(userId: string, productId: string) {
  await ownedProduct(userId, productId);
  return db()
    .select({ directory: directories, submission: submissions })
    .from(directories)
    .leftJoin(submissions, and(eq(submissions.directoryId, directories.id), eq(submissions.productId, productId)))
    .where(eq(directories.isActive, true))
    .orderBy(sql`${directories.dr} desc nulls last`, asc(directories.name));
}

export const trackerUpdate = z.object({
  productId: z.string().uuid(),
  directoryId: z.string().uuid(),
  status: z.enum(TRACKER_STATUSES),
  liveUrl: z
    .string()
    .trim()
    .max(500)
    .refine((u) => u === "" || /^https?:\/\/[^\s]+$/i.test(u), "Paste the full listing URL, starting with https://")
    .optional(),
  notes: z.string().trim().max(1000).optional(),
});

/**
 * Sets a directory's status in a maker's tracker. Marking it live with a URL
 * verifies the backlink straight away.
 */
export async function updateTracker(userId: string, raw: z.input<typeof trackerUpdate>) {
  const input = trackerUpdate.parse(raw);
  await ownedProduct(userId, input.productId);
  const directory = await db().query.directories.findFirst({ where: eq(directories.id, input.directoryId) });
  if (!directory) throw new TrackerError("Unknown directory.");
  if (input.status === "live" && !input.liveUrl) throw new TrackerError("Paste the URL of your live listing.");

  const now = new Date();
  const current = await db().query.submissions.findFirst({
    where: and(eq(submissions.productId, input.productId), eq(submissions.directoryId, input.directoryId)),
  });
  const urlChanged = input.liveUrl !== undefined && (input.liveUrl || null) !== (current?.liveUrl ?? null);
  const values = {
    status: input.status,
    submittedAt:
      current?.submittedAt ?? (["submitted", "pending", "live", "rejected"].includes(input.status) ? now : null),
    liveAt: input.status === "live" ? (current?.liveAt ?? now) : null,
    ...(input.liveUrl !== undefined ? { liveUrl: input.liveUrl || null } : {}),
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
    // A new URL needs a new check.
    ...(urlChanged
      ? { linkVerdict: null, linkRel: null, linkAnchor: null, linkHttpStatus: null, linkCheckedAt: null }
      : {}),
  };
  const [row] = current
    ? await db().update(submissions).set(values).where(eq(submissions.id, current.id)).returning()
    : await db()
        .insert(submissions)
        .values({ ...values, productId: input.productId, directoryId: input.directoryId })
        .returning();

  if (row.status === "live" && row.liveUrl && (urlChanged || !row.linkCheckedAt)) {
    return (await verifySubmission(row.id)) ?? row;
  }
  return row;
}

/** Re-runs the link check on one of the maker's live rows. */
export async function recheckTracker(userId: string, submissionId: string) {
  const s = await db().query.submissions.findFirst({ where: eq(submissions.id, submissionId) });
  if (!s?.productId) throw new TrackerError("Not found.");
  await ownedProduct(userId, s.productId);
  return verifySubmission(submissionId);
}

export type TrackerSummary = { live: number; dofollow: number; submitted: number; todo: number; total: number };

export function summarize(
  rows: Array<{ submission: { status: string; linkVerdict: string | null } | null }>,
): TrackerSummary {
  const by = (st: string) => rows.filter((r) => (r.submission?.status ?? "todo") === st).length;
  return {
    total: rows.length,
    live: by("live"),
    dofollow: rows.filter((r) => r.submission?.status === "live" && r.submission.linkVerdict === "dofollow").length,
    submitted: by("submitted") + by("pending"),
    todo: by("todo"),
  };
}
