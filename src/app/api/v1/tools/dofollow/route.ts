import { api, preflight } from "@/lib/api/http";
import { dofollow } from "@/lib/api/operations";

export const OPTIONS = preflight;

export async function POST(request: Request) {
  return api(request, ({ body, user, clientKey }) =>
    dofollow(body as { pageUrl: string; target: string }, { user, clientKey, source: "api" }),
  );
}
