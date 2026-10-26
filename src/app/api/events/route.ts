import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db";

const body = z.object({
  productId: z.string().uuid(),
  kind: z.enum(["view", "outbound_click"]),
  referrer: z.string().max(500).optional(),
});

const BOTS = /bot|crawler|spider|preview|fetch|curl|wget|headless/i;

/** Maker analytics beacon (views, outbound clicks). Best effort, never errors to the client. */
export async function POST(request: Request) {
  if (BOTS.test(request.headers.get("user-agent") ?? "")) return new Response(null, { status: 204 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response(null, { status: 204 });
  try {
    const exists = await db().query.products.findFirst({
      where: eq(schema.products.id, parsed.data.productId),
      columns: { id: true },
    });
    if (exists) {
      let referrer: string | null = null;
      try {
        referrer = parsed.data.referrer ? new URL(parsed.data.referrer).hostname : null;
      } catch {}
      await db()
        .insert(schema.productEvents)
        .values({ productId: parsed.data.productId, kind: parsed.data.kind, referrer });
    }
  } catch (err) {
    console.error("event insert failed", err);
  }
  return new Response(null, { status: 204 });
}
