import { z } from "zod";
import { isBot, recordClick } from "@/lib/ads/service";

/** Sponsored click-through: counts the click (not for bots) and redirects to the sponsor's site. */
export async function GET(request: Request, ctx: RouteContext<"/api/ads/[id]/click">) {
  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success) return new Response("Not found", { status: 404 });
  const count = !isBot(request.headers.get("user-agent")) && request.headers.get("purpose") !== "prefetch";
  const target = await recordClick(id, count);
  if (!target) return new Response("Not found", { status: 404 });
  return new Response(null, {
    status: 302,
    headers: { Location: target, "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" },
  });
}
