import { api, preflight } from "@/lib/api/http";
import { domainRating } from "@/lib/api/operations";

export const OPTIONS = preflight;

export async function POST(request: Request) {
  return api(request, ({ body, user, clientKey }) =>
    domainRating(body as { domain: string }, { user, clientKey, source: "api" }),
  );
}
