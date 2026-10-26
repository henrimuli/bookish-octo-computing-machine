import { and, count, eq, min } from "drizzle-orm";
import { db, schema } from "@/db";
import { badgeSvg } from "@/lib/badges/svg";

/**
 * Badge image for a listing: /badge/{slug}?theme=light|dark&kind=featured|winner&votes=1
 * Unknown slugs still get the generic badge so a maker's site never shows a broken image.
 */
export async function GET(request: Request, ctx: RouteContext<"/badge/[slug]">) {
  const { slug } = await ctx.params;
  const params = new URL(request.url).searchParams;
  const theme = params.get("theme") === "dark" ? "dark" : "light";
  const wantsWinner = params.get("kind") === "winner";
  const showVotes = params.get("votes") === "1";

  let place: number | undefined;
  let votes: number | undefined;
  try {
    const p = await db().query.products.findFirst({ where: eq(schema.products.slug, slug), columns: { id: true } });
    if (p && wantsWinner) {
      const [best] = await db()
        .select({ place: min(schema.awards.place) })
        .from(schema.awards)
        .where(and(eq(schema.awards.productId, p.id), eq(schema.awards.scope, "week")));
      place = best?.place ?? undefined;
    }
    if (p && showVotes) {
      const [row] = await db().select({ n: count() }).from(schema.votes).where(eq(schema.votes.productId, p.id));
      votes = row?.n ?? 0;
    }
  } catch (err) {
    console.error("badge lookup failed", err);
  }

  const svg = badgeSvg({ kind: place ? "winner" : "featured", theme, place, votes });
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
