import { z } from "zod";
import { isBot, recordImpressions } from "@/lib/ads/service";

const body = z.object({ ids: z.array(z.string().uuid()).max(12) });

/** Sponsored impressions beacon. Best effort, never errors to the client. */
export async function POST(request: Request) {
  if (isBot(request.headers.get("user-agent"))) return new Response(null, { status: 204 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (parsed.success) {
    await recordImpressions([...new Set(parsed.data.ids)]).catch((err) => console.error("impressions failed", err));
  }
  return new Response(null, { status: 204 });
}
