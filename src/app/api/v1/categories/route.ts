import { api, preflight } from "@/lib/api/http";
import { categories } from "@/lib/api/operations";

export const OPTIONS = preflight;

export async function GET(request: Request) {
  return api(request, () => categories());
}
