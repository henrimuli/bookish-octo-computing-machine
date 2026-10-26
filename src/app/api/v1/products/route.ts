import { api, preflight } from "@/lib/api/http";
import { searchProducts } from "@/lib/api/operations";

export const OPTIONS = preflight;

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  return api(request, () =>
    searchProducts({
      query: params.get("q") ?? undefined,
      category: params.get("category") ?? undefined,
      limit: params.get("limit") ? Number(params.get("limit")) : undefined,
    }),
  );
}
