import { api, preflight } from "@/lib/api/http";
import { getProduct } from "@/lib/api/operations";

export const OPTIONS = preflight;

export async function GET(request: Request, ctx: RouteContext<"/api/v1/products/[slug]">) {
  const { slug } = await ctx.params;
  return api(request, () => getProduct({ slug }));
}
