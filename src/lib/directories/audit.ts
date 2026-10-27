import "server-only";
import { and, eq, gt, isNull, lt, or, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { env } from "@/env";
import { site } from "@/config/site";
import { sendEmail } from "@/lib/email";
import { safeFetchText } from "@/lib/net";

const { directories } = schema;
const DAY = 86_400_000;

/** Healthy directories are re-checked monthly; failing ones every few days until they recover or are retired. */
export const AUDIT_EVERY_DAYS = 30;
export const AUDIT_RETRY_DAYS = 3;
export const AUDIT_DEACTIVATE_AFTER = 3;

const ts = (d: Date) => sql`${d.toISOString()}::timestamptz`;

/**
 * The monthly directory audit: is each active directory's homepage still up?
 * Three failures in a row deactivate it (staff see the flag in the admin).
 * Runs from the daily cron in small batches. (The observed link type is
 * re-derived daily from recent link checks by refreshDirectoryStats.)
 */
export async function auditDirectories(now = new Date(), batch = 40) {
  const due = await db()
    .select()
    .from(directories)
    .where(
      and(
        eq(directories.isActive, true),
        or(
          isNull(directories.auditedAt),
          and(
            eq(directories.auditFailures, 0),
            lt(directories.auditedAt, ts(new Date(now.getTime() - AUDIT_EVERY_DAYS * DAY))),
          ),
          and(
            gt(directories.auditFailures, 0),
            lt(directories.auditedAt, ts(new Date(now.getTime() - AUDIT_RETRY_DAYS * DAY))),
          ),
        ),
      ),
    )
    .orderBy(sql`${directories.auditedAt} asc nulls first`)
    .limit(batch);

  let failed = 0;
  const retired: string[] = [];
  for (const d of due) {
    let error: string | null = null;
    try {
      const page = await safeFetchText(d.url, { timeoutMs: 10_000, maxBytes: 200_000 });
      if (page.status >= 400) error = `HTTP ${page.status}`;
    } catch (err) {
      error = err instanceof Error ? err.message.slice(0, 200) : "Fetch failed";
    }
    const failures = error ? d.auditFailures + 1 : 0;
    const retire = failures >= AUDIT_DEACTIVATE_AFTER;
    await db()
      .update(directories)
      .set({ auditedAt: now, auditFailures: failures, auditError: error, ...(retire ? { isActive: false } : {}) })
      .where(eq(directories.id, d.id));
    if (error) failed++;
    if (retire) retired.push(`${d.name} (${d.url}): ${error}`);
  }

  if (retired.length) {
    const intro = `These directories failed ${AUDIT_DEACTIVATE_AFTER} audits in a row and are no longer picked for orders:`;
    const outro = "Reactivate one in /admin/directories if it's back.";
    const esc = (v: string) =>
      v.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
    await sendEmail({
      to: env().ADMIN_EMAIL ?? site.supportEmail,
      subject: `Directory audit: ${retired.length} ${retired.length === 1 ? "directory" : "directories"} deactivated`,
      text: [intro, ...retired.map((r) => `- ${r}`), outro].join("\n"),
      html: `<p>${esc(intro)}</p><ul>${retired.map((r) => `<li>${esc(r)}</li>`).join("")}</ul><p>${esc(outro)}</p>`,
    });
  }

  return { audited: due.length, failed, deactivated: retired.length };
}
