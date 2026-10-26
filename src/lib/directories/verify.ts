import "server-only";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { safeFetchText, UnsafeUrlError } from "@/lib/net";
import { domainOf } from "@/lib/slug";
import { inspectBacklink } from "./backlink";

const { submissions, linkChecks } = schema;

/** The domain a submission's backlink should point to: the DIY product's, or the order's website. */
async function targetDomain(s: typeof submissions.$inferSelect): Promise<string | null> {
  if (s.productId) {
    const p = await db().query.products.findFirst({
      where: eq(schema.products.id, s.productId),
      columns: { domain: true },
    });
    return p?.domain ?? null;
  }
  if (s.submissionOrderId) {
    const o = await db().query.submissionOrders.findFirst({
      where: eq(schema.submissionOrders.id, s.submissionOrderId),
      columns: { websiteUrl: true },
    });
    try {
      return o?.websiteUrl ? domainOf(o.websiteUrl) : null;
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Fetches a live listing and checks it links to the product: reachable,
 * link present, rel, anchor text. Records a link_checks row and the latest
 * result on the submission. Machine-verified, never self-reported.
 */
export async function verifySubmission(submissionId: string) {
  const s = await db().query.submissions.findFirst({ where: eq(submissions.id, submissionId) });
  if (!s?.liveUrl) return null;
  const domain = await targetDomain(s);
  if (!domain) return null;

  let result: {
    verdict: "dofollow" | "nofollow" | "missing" | "unreachable";
    httpStatus: number | null;
    rel: string | null;
    anchor: string | null;
    error: string | null;
  };
  try {
    const page = await safeFetchText(s.liveUrl, { timeoutMs: 10_000 });
    if (page.status >= 400) {
      result = {
        verdict: "unreachable",
        httpStatus: page.status,
        rel: null,
        anchor: null,
        error: `HTTP ${page.status}`,
      };
    } else {
      const link = inspectBacklink(page.body, page.url, domain);
      result = { verdict: link.verdict, httpStatus: page.status, rel: link.rel, anchor: link.anchor, error: null };
    }
  } catch (err) {
    const error =
      err instanceof UnsafeUrlError ? err.message : err instanceof Error ? err.message.slice(0, 200) : "Fetch failed";
    result = { verdict: "unreachable", httpStatus: null, rel: null, anchor: null, error };
  }

  const now = new Date();
  await db()
    .insert(linkChecks)
    .values({ submissionId, checkedAt: now, ...result });
  const [updated] = await db()
    .update(submissions)
    .set({
      linkVerdict: result.verdict,
      linkRel: result.rel,
      linkAnchor: result.anchor,
      linkHttpStatus: result.httpStatus,
      linkCheckedAt: now,
    })
    .where(eq(submissions.id, submissionId))
    .returning();
  return updated;
}
